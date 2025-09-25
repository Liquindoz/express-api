pipeline {
  agent any
  options { timestamps() }

  tools {
    nodejs 'Node 20'                  // Manage Jenkins → Global Tool Configuration
  }

  environment {
    SCANNER_HOME = tool 'SonarScanner' // Manage Jenkins → Global Tool Configuration
    // change HOST_PORT if 3000 is busy on your host; APP_PORT must match your app's internal port
    HOST_PORT   = '3000'
    APP_PORT    = '3000'
  }

  stages {

    stage('Checkout SCM') {
      steps {
        git branch: 'main', url: 'https://github.com/Liquindoz/express-api.git'
      }
    }

    stage('Build') {
      steps {
        sh 'node -v && npm -v'
        sh 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'
      }
    }

    stage('Test') {
      steps {
        sh '''
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --runInBand
        '''
      }
    }

    stage('Code Quality') {
      steps {
        // Generate coverage for SonarQube
        sh '''
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --coverage --coverageReporters=lcov --coverageReporters=text
        '''

        // 'sonarqube' must match the name under Manage Jenkins → System → SonarQube servers
        withSonarQubeEnv('sonarqube') {
          sh """
            ${SCANNER_HOME}/bin/sonar-scanner \
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
        sh '''
          set -e
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

          sh """
            set -e

            # stop any previous test container
            docker rm -f express-api-test || true

            echo "[Deploy] Building image ${IMAGE}"
            docker build --pull -t ${IMAGE} .

            echo "[Deploy] Running container on host:${HOST_PORT} -> app:${APP_PORT}"
            docker run -d --name express-api-test -p ${HOST_PORT}:${APP_PORT} \\
              -e PORT=${APP_PORT} \\
              ${IMAGE}

            echo "[Deploy] docker ps:"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Deploy] Waiting for health endpoint..."
            i=0
            until curl -fsS http://localhost:${HOST_PORT}/health >/dev/null 2>&1; do
              i=\$((i+1))
              if [ \$i -gt 60 ]; then
                echo "Health check failed after 60s. Showing container logs:"
                docker logs express-api-test || true
                exit 1
              fi
              sleep 1
            done

            echo "[Deploy] Health check OK"
          """
        }
      }
    }
  }

  post {
    always {
      // keep coverage if present
      archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true, fingerprint: true
    }
  }
}
