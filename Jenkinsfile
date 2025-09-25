pipeline {
  agent any
  options { timestamps() }

  tools { nodejs 'Node 20' }                  // Manage Jenkins → Global Tool Configuration
  environment {
    SCANNER_HOME = tool 'SonarScanner'        // Manage Jenkins → Global Tool Configuration
    HOST_PORT = '8082'                         // external host port
    APP_PORT  = '3000'                         // internal app port
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

            # Clean previous container
            docker rm -f express-api-test || true

            echo "[Deploy] Building image ${IMAGE}"
            docker build --pull -t ${IMAGE} .

            echo "[Deploy] Running container on host:${HOST_PORT} -> app:${APP_PORT}"
            docker run -d --name express-api-test -p ${HOST_PORT}:${APP_PORT} \\
              -e NODE_ENV=production \\
              -e PORT=${APP_PORT} \\
              ${IMAGE}

            echo "[Deploy] docker ps:"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Deploy] Waiting for health (probing inside container netns)…"
            for i in {1..60}; do
              if docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                echo "[Deploy] Healthy "
                docker logs --tail=80 express-api-test || true
                exit 0
              fi
              echo "  …not healthy yet (\$i/60)"
              sleep 1
            done

            echo "[Deploy] Health check failed — showing logs"
            docker logs --tail=300 express-api-test || true
            exit 1
          """
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true, fingerprint: true
    }
  }
}
