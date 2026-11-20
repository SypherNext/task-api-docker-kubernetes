# Task API for Docker and Kubernetes

A small HTTP API for tasks, written in plain Node.js (`node:http` and the `pg` driver) with a PostgreSQL 18 database, together with everything that packages and deploys it: a multi-stage, non-root Dockerfile with a health check, a Docker Compose file that runs the API and PostgreSQL with the password passed as a file, and the Kubernetes manifests for a namespace with three to six API replicas, PostgreSQL on persistent storage, probes, limits, an autoscaler and a disruption budget. This repository is the companion code for the Sypher course "Docker & Kubernetes Hands-On". The app is at version 1.1.0, where the course leaves it after the rolling-update lesson.

## Set up your computer

You need Git and Docker to build and run the app, and kubectl plus a local Kubernetes cluster (the course uses kind) to deploy it. Node.js is optional: the app runs inside the image, and you only need Node on your machine to run the tests outside Docker.

The commands are written for a bash shell (macOS, Linux, or Git Bash on Windows). In Windows PowerShell, put multi-line commands on one line without the trailing `\`, and type `curl.exe` instead of `curl` (in Windows PowerShell 5.1, `curl` is a different command); the `curl` lines that send JSON are simplest to run from Git Bash, because PowerShell quotes them differently. In Git Bash on Windows, run `export MSYS_NO_PATHCONV=1` once per session, so Git Bash does not rewrite arguments such as `/etc/task-api/db` into Windows paths.

### Git

| System | Install |
|---|---|
| Windows | `winget install --id Git.Git -e` (or the installer from https://git-scm.com/downloads) |
| macOS | `brew install git` (or run `xcode-select --install` for Apple's copy) |
| Ubuntu, Debian | `sudo apt update && sudo apt install git` |
| Fedora | `sudo dnf install git` |

Check it:

```bash
git --version
```

It prints something like `git version 2.51.0`. Any 2.x version works.

### Docker

| System | Install |
|---|---|
| Windows | Docker Desktop: `winget install -e --id Docker.DockerDesktop`, or the installer from https://docs.docker.com/desktop/. It needs WSL 2 version 2.1.5 or later: check with `wsl --version` in PowerShell, and run `wsl --update` (or `wsl --install` on a fresh machine) if needed. Keep **Use WSL 2 instead of Hyper-V** selected, then start Docker Desktop from the Start menu. |
| macOS | Docker Desktop: `brew install --cask docker`, or the installer from https://docs.docker.com/desktop/. Start Docker from Applications. |
| Linux | Docker Engine: `curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh`, then `sudo usermod -aG docker $USER` and open a new shell. For servers, use the `apt` or `dnf` repository steps at https://docs.docker.com/engine/install/ instead. |

Check it:

```bash
docker version --format "{{.Server.Version}}"
docker compose version
```

The first command prints the engine version (for example `28.0.1`), the second something like `Docker Compose version v2.33.1`. If the first one prints an error about connecting to the Docker daemon, Docker is installed but not running: start Docker Desktop (or `sudo systemctl start docker` on Linux).

### kubectl

| System | Install |
|---|---|
| Windows | `winget install -e --id Kubernetes.kubectl` |
| macOS | `brew install kubectl` |
| Linux (x86-64) | `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` then `sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl` |

Docker Desktop also ships a `kubectl`. If you install your own, make sure the one you want comes first on your `PATH`. Check it:

```bash
kubectl version --client
```

It prints `Client Version: v1.x.x` and a `Kustomize Version` line. Use a client within one minor version of your cluster (the course uses Kubernetes 1.37).

### kind (a local Kubernetes cluster)

kind runs each Kubernetes node as a Docker container, so it needs Docker running.

| System | Install |
|---|---|
| Windows | `winget install Kubernetes.kind` |
| macOS | `brew install kind` |
| Linux (x86-64) | `curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64 && chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind` |

Check it:

```bash
kind version
```

It prints something like `kind v0.33.0 go1.25.0 linux/amd64`. minikube or the Kubernetes built into Docker Desktop work too; with those, replace `kind load docker-image` below with that tool's way of getting a local image into the cluster (for minikube, `minikube image load`).

### Node.js (optional)

Only needed for `npm test` outside Docker. Install Node.js 24 LTS or newer (the image itself uses Node 26):

| System | Install |
|---|---|
| Windows | `winget install OpenJS.NodeJS.LTS` |
| macOS | `brew install node@24` |
| Linux | the commands for your distribution on https://nodejs.org/en/download |

Or use a version manager: nvm (https://github.com/nvm-sh/nvm, macOS and Linux) with `nvm install 24`, or fnm (`winget install Schniz.fnm` or `brew install fnm`) with `fnm install 24`. Check with `node --version`, which prints `v24.x.x` or newer.

### Get the code

Clone the repository (use the address of the repository you were given) and go into the folder:

```bash
git clone <repository-url> task-api-docker-kubernetes
cd task-api-docker-kubernetes
```

Or download it as a ZIP from the repository's page, unzip it, and open a terminal in the unzipped folder. Every command below runs from this folder.

## Run the app

### With Docker Compose

1. Create the database password file. It is read by PostgreSQL and by the API as a mounted secret, and `.gitignore` keeps it out of Git:

   ```bash
   printf 'compose-dev-password' > secrets/db_password.txt
   ```

   Use any password you like; `printf` writes it without a trailing newline.

2. Build the image and start both containers in the background:

   ```bash
   docker compose up -d --build
   ```

   Compose builds `dkh-task-api:1.1.0`, starts PostgreSQL (`dkh-db-1`), waits until its health check passes, then starts the API (`dkh-api-1`). The first build downloads the `node:26-alpine` and `postgres:18-alpine` images.

3. Check it:

   ```bash
   docker compose ps
   curl -s http://localhost:18300/readyz; echo
   curl -s -X POST http://localhost:18300/tasks -d "{\"title\":\"Run everything with Compose\"}"; echo
   curl -s "http://localhost:18300/tasks?done=false"; echo
   ```

   Both containers show `(healthy)`, and the three requests print:

   ```text
   {"status":"ready"}
   {"id":1,"title":"Run everything with Compose","done":false}
   [{"id":1,"title":"Run everything with Compose","done":false}]
   ```

4. Stop it. `down` keeps the database volume; `down -v` deletes it too:

   ```bash
   docker compose down
   ```

The API also runs without a database: `docker build -t dkh-task-api:1.1.0 .` and `docker run -d --name dkh-api -p 18301:3000 dkh-task-api:1.1.0` start it with an in-memory store, and `curl -s http://localhost:18301/` shows `"store":"memory"`. Remove it with `docker rm -f dkh-api`.

### On Kubernetes with kind

1. Create a cluster:

   ```bash
   kind create cluster
   kubectl get nodes
   ```

   One node, `kind-control-plane`, with status `Ready`.

2. Build the image and load it into the cluster (kind nodes cannot see your local images otherwise):

   ```bash
   docker build -t dkh-task-api:1.1.0 .
   kind load docker-image dkh-task-api:1.1.0
   ```

3. Create the namespace and the Secret. The Secret is made from your password file, so the password never appears in a manifest:

   ```bash
   kubectl apply -f k8s/capstone/namespace.yaml
   kubectl create secret generic db-credentials -n tasks --from-file=password=./secrets/db_password.txt
   ```

   Expected output: `namespace/tasks created` and `secret/db-credentials created`.

4. Apply everything else and wait for it:

   ```bash
   kubectl apply -k k8s/capstone
   kubectl -n tasks rollout status statefulset/postgres
   kubectl -n tasks rollout status deployment/task-api
   ```

   The API Pods may restart once or twice while PostgreSQL initialises; the rollout ends with `deployment "task-api" successfully rolled out`.

5. In a second terminal, forward a local port to the Service and leave it running:

   ```bash
   kubectl -n tasks port-forward svc/task-api 18080:80
   ```

6. Back in the first terminal:

   ```bash
   curl -s http://localhost:18080/readyz; echo
   curl -s -X POST http://localhost:18080/tasks -d "{\"title\":\"Deploy to Kubernetes\"}"; echo
   curl -s http://localhost:18080/; echo
   ```

   Expected output (your Pod name differs):

   ```text
   {"status":"ready"}
   {"id":1,"title":"Deploy to Kubernetes","done":false}
   {"service":"task-api","version":"1.1.0","host":"task-api-7f6d9b8c5k-4wn2x","store":"postgres"}
   ```

7. Clean up: `kubectl delete namespace tasks` deletes everything in it, including the database volume, and `kind delete cluster` removes the cluster.

The autoscaler needs metrics-server. Without it, `kubectl -n tasks get hpa` shows `<unknown>` targets and the Deployment simply stays at 3 replicas; everything else works. To install it on kind:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

`kubectl kustomize k8s/capstone` prints all eight objects without needing a cluster, which is a quick way to check the folder after you change it.

## Running the tests

The Dockerfile has a `test` stage that installs all dependencies and runs the three tests. Build it on purpose:

```bash
docker build --target test -t dkh-task-api:test .
```

The build log shows `ℹ pass 3` and `ℹ fail 0`; if a test fails, the build stops. With Node installed, you can also run them directly:

```bash
npm ci
npm test
```

## Project layout

```text
src/server.js            starts the HTTP server, picks the store, shuts down cleanly on SIGTERM
src/app.js               the routes: /, /healthz, /readyz, /tasks, /tasks/{id}; one JSON log line per request
src/config.js            reads PORT, APP_VERSION and DB_* settings; DB_PASSWORD_FILE for secrets as files
src/store.js             an in-memory store and a PostgreSQL store with the same methods
test/app.test.js         three tests with node:test
healthcheck.js           used by the Dockerfile HEALTHCHECK
Dockerfile               three stages: deps, test, runtime (node:26-alpine, runs as user node)
.dockerignore            keeps node_modules, secrets, k8s and Git out of the build context
compose.yaml             the API and PostgreSQL 18, a named volume, the password as a Compose secret
secrets/                 your db_password.txt goes here (never committed)
.env.example             the settings, for running the app by hand
k8s/capstone/            the final manifests: namespace, ConfigMap, PostgreSQL StatefulSet, API Deployment and Service, HPA, PDB, kustomization
k8s/lessons/             the teaching manifests from lessons 11 to 17, named by lesson
```

`k8s/lessons/` keeps the smaller manifests the lessons build on the way to the capstone, so you can compare them with yours. In the lessons they live in `k8s/` under the names without the number (for example `k8s/lessons/13-deployment.yaml` is `k8s/deployment.yaml` as it stands after lesson 13). They use the `default` namespace and are not meant to be applied together with `k8s/capstone`.

| File | Lesson | What it shows |
|---|---|---|
| `11-pod.yaml`, `11-deployment.yaml` | Pods and Deployments | one Pod, then a Deployment of three |
| `12-service.yaml`, `12-service-nodeport.yaml` | Services and Traffic | ClusterIP and NodePort Services |
| `12-ingress.yaml`, `12-gateway.yaml` | Services and Traffic | HTTP routing with Ingress and with the Gateway API |
| `13-configmap.yaml`, `13-postgres-temp.yaml`, `13-deployment.yaml` | ConfigMaps and Secrets | configuration, a throwaway PostgreSQL, the password as a mounted file |
| `14-pvc.yaml`, `14-pvc-pod.yaml`, `14-postgres.yaml` | Persistent Storage | a PersistentVolumeClaim, then PostgreSQL as a StatefulSet |
| `15-deployment.yaml`, `15-hpa.yaml` | Health, Resources and Autoscaling | probes, requests and limits, the autoscaler |
| `16-deployment.yaml` | Rolling Updates and Rollbacks | the rollout strategy and change-cause annotation (release 1.0.0) |
| `17-bad-image.yaml`, `17-crashloop.yaml`, `17-missing-secret.yaml`, `17-oom.yaml` | Debugging Containers and Pods | broken on purpose: ImagePullBackOff, CrashLoopBackOff, a missing Secret, OOMKilled |

## Troubleshooting

- **`Cannot connect to the Docker daemon` or `error during connect`.** Docker is not running. Start Docker Desktop (or `sudo systemctl start docker` on Linux) and wait until it is ready. kind needs Docker running too.
- **`Bind for 127.0.0.1:18300 failed: port is already allocated`.** Another container or program uses port 18300. Find it with `docker ps`, stop it, or change the left side of `127.0.0.1:18300:3000` in `compose.yaml`. The same applies to 18080 for `kubectl port-forward`.
- **The `db` container keeps restarting and `docker compose logs db` says `Database is uninitialized and superuser password is not specified`.** You ran `docker compose up` before creating `secrets/db_password.txt`, and Docker created an empty folder with that name in its place. Run `docker compose down -v`, delete the folder `secrets/db_password.txt`, create the file as in step 1, and start again.
- **`/readyz` answers 503 with `password authentication failed`.** PostgreSQL only reads its password on the first start with an empty volume. If you changed `secrets/db_password.txt` afterwards, run `docker compose down -v` to delete the old volume, then `docker compose up -d` again. On Kubernetes, delete and recreate the Secret and the `tasks` namespace.
- **Pods stuck in `ErrImagePull` or `ImagePullBackOff`.** The cluster cannot find `dkh-task-api:1.1.0`. Run `kind load docker-image dkh-task-api:1.1.0` again (and again after every rebuild, or after `kind create cluster`), and check that the tag in `k8s/capstone/api.yaml` matches the image you built.

## License

Copyright (C) 2026 SypherNext

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). You may
use, study and change it. If you share a modified version, or run one as a website or service
that other people use, you must make your full modified source code available under the same
license. See [LICENSE](LICENSE) for the full terms.
