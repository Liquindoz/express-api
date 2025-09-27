pipeline {
  agent any
  options { timestamps() }
  tools { nodejs 'Node 20' }

  environment {
    HOST_PORT = '3031'      // host/external port to open in the browser
    APP_PORT  = '3000'      // internal container port (the app listens on this)
  }

  stages {

    stage('Checkout') {
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

    stage('Security') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          npm audit --audit-level=high --json > audit.json || true
          if grep -q '"severity":"\\(high\\|critical\\)"' audit.json; then
            echo "Vulnerabilities are found"
            head -n 150 audit.json || true
            exit 1
          else
            echo "No Vulnerabilities detected"
          fi
        '''
        archiveArtifacts artifacts: 'audit.json', fingerprint: true
      }
    }

    stage('Deploy (staging)') {
      steps {
        script {
          def IMAGE = "express-api:${env.BUILD_NUMBER}"
          sh """#!/bin/bash
            set -euo pipefail

            docker rm -f express-api-test || true

            echo "[Deploy] Build image ${IMAGE}"
            docker build --pull -t ${IMAGE} .

            echo "[Deploy] Run staging: host:${HOST_PORT} -> app:${APP_PORT}"
            docker run -d --name express-api-test -p ${HOST_PORT}:${APP_PORT} \
              -e NODE_ENV=production \
              -e PORT=${APP_PORT} \
              ${IMAGE}

            echo "[Deploy] docker ps:"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Deploy] Health check (container netns)"
            for i in {1..60}; do
              if docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1; then
                echo "[Deploy] Healthy"
                docker logs --tail=80 express-api-test || true
                exit 0
              fi
              echo "  Not healthy (\$i/60)"
              sleep 1
            done

            echo "[Deploy] Health check failed"
            docker logs --tail=300 express-api-test || true
            exit 1
          """
        }
      }
    }

    stage('Release (production)') {
      steps {
        script {
          def IMAGE = "express-api:${env.BUILD_NUMBER}"
          sh """#!/bin/bash
            set -euo pipefail

            docker rm -f express-api-prod || true

            echo "[Release] Run production: host:${HOST_PORT} -> app:${APP_PORT}"
            docker run -d --name express-api-prod -p ${HOST_PORT}:${APP_PORT} \
              -e NODE_ENV=production \
              -e PORT=${APP_PORT} \
              ${IMAGE}

            echo "[Release] docker ps:"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Release] Health check (container netns)"
            for i in {1..60}; do
              if docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1; then
                echo "[Release] PRODUCTION Healthy"
                docker logs --tail=100 express-api-prod || true
                exit 0
              fi
              echo "  Not healthy (\$i/60)"
              sleep 1
            done

            echo "[Release] health production FAILED"
            docker logs --tail=250 express-api-prod || true
            exit 1
          """
        }
      }
    }

    stage('Monitor') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          echo "[Monitoring] Verify from inside container"

          HEALTH="http://localhost:${APP_PORT}/health"
          if docker exec express-api-prod sh -c "wget -qO- $HEALTH >/dev/null 2>&1"; then
            echo "[Monitoring] Health is good!"
          else
            echo "[Monitoring] Health is FAILED"
            docker logs --tail=120 express-api-prod || true
            exit 1
          fi

          echo "[Monitoring] Container stats"
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
