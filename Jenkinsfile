pipeline {
  agent any
  options { timestamps() }

  tools { nodejs 'Node 20' }  // Manage Jenkins → Global Tool Configuration

  environment {
    SCANNER_HOME = tool 'SonarScanner'        // Manage Jenkins → Global Tool Configuration
    HOST_PORT = '8082'                         // staging/test external port
    APP_PORT  = '3000'                         // app internal port
  }

  stages {

    stage('Checkout SCM') {
      steps {
        git branch: 'main', url: 'https://github.com/Liquindoz/express-api.git'
      }
    }

    stage('Build') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          node -v && npm -v
          if [ -f package-lock.json ]; then npm ci; else npm install; fi
        '''
      }
    }

    stage('Test') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --runInBand
        '''
      }
    }

    stage('Code Quality') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --coverage --coverageReporters=lcov --coverageReporters=text
        '''
        withSonarQubeEnv('sonarqube') {
          sh """#!/bin/bash
            set -euo pipefail
            "\${SCANNER_HOME}/bin/sonar-scanner" \
              -Dsonar.projectKey=express-api \
              -Dsonar.projectName=express-api \
              -Dsonar.sources=src \
              -Dsonar.tests=tests \
              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
          """
        }
      }
    }

    stage('Security') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          npm audit --audit-level=high --json > audit.json || true

          if grep -q '"severity":"\\(high\\|critical\\)"' audit.json; then
            echo "High/Critical vulnerabilities found."
            head -n 200 audit.json
            exit 1
          else
            echo "No high/critical vulnerabilities found."
          fi
        '''
        archiveArtifacts artifacts: 'audit.json', fingerprint: true
      }
    }

    stage('Deploy') {
      steps {
        script {
          def IMAGE = "express-api:${env.BUILD_NUMBER}"
          sh """#!/bin/bash
            set -euo pipefail

            docker rm -f express-api-test || true

            echo "[Deploy] Building image ${IMAGE}"
            docker build --pull -t ${IMAGE} .

            echo "[Deploy] Running TEST container on host:${HOST_PORT} -> app:${APP_PORT}"
            docker run -d --name express-api-test -p ${HOST_PORT}:${APP_PORT} \\
              -e NODE_ENV=production \\
              -e PORT=${APP_PORT} \\
              ${IMAGE}

            echo "[Deploy] docker ps:"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Deploy] Waiting for TEST health (inside container netns)…"
            for i in {1..60}; do
              if docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                echo "[Deploy] TEST Healthy ✅"
                docker logs --tail=80 express-api-test || true
                exit 0
              fi
              echo "  …not healthy yet (\$i/60)"
              sleep 1
            done

            echo "[Deploy] TEST health check failed ❌"
            docker logs --tail=300 express-api-test || true
            exit 1
          """
        }
      }
    }

    stage('Release') {
      steps {
        script {
          def IMAGE = "express-api:${env.BUILD_NUMBER}"
          sh """#!/bin/bash
            set -euo pipefail

            echo "[Release] Cleaning up old PRODUCTION container"
            docker rm -f express-api-prod || true

            echo "[Release] Running PRODUCTION container from ${IMAGE}"
            docker run -d --name express-api-prod -p 9090:${APP_PORT} \\
              -e NODE_ENV=production \\
              -e PORT=${APP_PORT} \\
              ${IMAGE}

            echo "[Release] docker ps:"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Release] Waiting for PRODUCTION health (inside container netns)…"
            for i in {1..60}; do
              if docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                echo "[Release] PRODUCTION Healthy ✅"
                docker logs --tail=80 express-api-prod || true
                exit 0
              fi
              echo "  …not healthy yet (\$i/60)"
              sleep 1
            done

            echo "[Release] PRODUCTION health check failed ❌"
            docker logs --tail=300 express-api-prod || true
            exit 1
          """
        }
      }
    }

    stage('Monitoring') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          echo "[Monitoring] Checking PRODUCTION container health (wget inside container)…"

          HEALTH1="http://localhost:${APP_PORT}/health"
          HEALTH2="http://localhost:${APP_PORT}/api/health"
          HEALTH3="http://localhost:${APP_PORT}/"

          if docker exec express-api-prod sh -c "wget -qO- $HEALTH1 >/dev/null 2>&1" || \
             docker exec express-api-prod sh -c "wget -qO- $HEALTH2 >/dev/null 2>&1" || \
             docker exec express-api-prod sh -c "wget -qO- $HEALTH3 >/dev/null 2>&1"; then
            echo "[Monitoring] Health check OK ✅"
          else
            echo "[Monitoring] Health check FAILED ❌"
            docker logs --tail=120 express-api-prod || true
            exit 1
          fi

          echo "[Monitoring] Container stats (snapshot)…"
          docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}\\t{{.BlockIO}}"
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true, fingerprint: true
    }
  }
}
