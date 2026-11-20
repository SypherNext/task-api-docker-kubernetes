import pg from 'pg';

export function memoryStore() {
  const tasks = new Map();
  let nextId = 1;
  return {
    kind: 'memory',
    async init() {},
    async ping() {},
    async list() {
      return [...tasks.values()];
    },
    async create(title) {
      const task = { id: nextId++, title, done: false };
      tasks.set(task.id, task);
      return task;
    },
    async update(id, done) {
      const task = tasks.get(id);
      if (!task) return null;
      task.done = done;
      return task;
    },
    async remove(id) {
      return tasks.delete(id);
    },
    async close() {},
  };
}

export function postgresStore(db, log) {
  const pool = new pg.Pool({ ...db, max: 5, connectionTimeoutMillis: 2000 });
  // Without this handler, a database restart kills the whole process.
  pool.on('error', (err) => log({ msg: 'idle database connection lost', error: err.message }));
  return {
    kind: 'postgres',
    async init() {
      for (let attempt = 1; ; attempt++) {
        try {
          await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            done BOOLEAN NOT NULL DEFAULT false)`);
          return;
        } catch (err) {
          log({ msg: 'database not reachable yet', attempt, error: err.message });
          if (attempt === 5) throw err;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    },
    async ping() {
      await pool.query('SELECT 1');
    },
    async list() {
      const { rows } = await pool.query('SELECT id, title, done FROM tasks ORDER BY id');
      return rows;
    },
    async create(title) {
      const { rows } = await pool.query('INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done', [title]);
      return rows[0];
    },
    async update(id, done) {
      const { rows } = await pool.query('UPDATE tasks SET done = $2 WHERE id = $1 RETURNING id, title, done', [id, done]);
      return rows[0] ?? null;
    },
    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return rowCount > 0;
    },
    async close() {
      await pool.end();
    },
  };
}
