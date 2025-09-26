pipeline {
  agent any
  options { timestamps() }

  tools { nodejs 'Node 20' }

  parameters {
    string(name: 'STAGING_PORT', defaultValue: '8085')
    string(name: 'PROD_PORT',    defaultValue: '9095')
  }

  environment {
    SCANNER_HOME = tool 'SonarScanner'      // SonarScanner tool
    APP_PORT     = '3000'                   // internal app port
  }

  stages {

    stage('Checkout the SCM') {
      steps {
        git branch: 'main', url: 'https://github.com/Liquindoz/express-api.git'
      }
    }

    stage('Build Stage') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          echo "Check for NPM and Node version"
          if [ -f package-lock.json ]; then npm ci; else npm install; fi
        '''
      }
    }

    stage('Test Stage') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --runInBand
        '''
      }
    }

    stage('Code analysis') {
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
              -Dsonar.projectKey=mydev-ci \
              -Dsonar.projectName="Student Node API" \
              -Dsonar.sources=src \
              -Dsonar.tests=tests \
              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
          """
        }
        // Enforce the quality gate (no yellow “!”). Requires SonarQube webhook to Jenkins.
        timeout(time: 10, unit: 'MINUTES') {
          def qg = waitForQualityGate()          // returns [status: 'OK' | 'WARN' | 'ERROR' | 'CANCELED']
          if (qg.status != 'OK') {
            error "Quality gate failed: ${qg.status}"
          }
        }
      }
    }

    stage('Security Stage') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          npm audit --audit-level=high --json > audit.json || true

          if grep -q '"severity":"\\(high\\|critical\\)"' audit.json; then
            echo "Vulnerabilities are founded!!!"
            head -n 200 audit.json
            exit 1
          else
            echo "Not vulnerabilities found"
          fi
        '''
        archiveArtifacts artifacts: 'audit.json', fingerprint: true
      }
    }

    stage('Deploy Stage') {
      steps {
        script {
          def IMAGE = "mydev-ci:${env.BUILD_NUMBER}"
          sh """#!/bin/bash
            set -euo pipefail

            docker rm -f mydev-stag || true

            echo "[Deploy] Building image ${IMAGE}"
            docker build --pull -t ${IMAGE} .

            echo "[Deploy] Begin Testing on the host:${params.STAGING_PORT} -> app:${APP_PORT}"
            docker run -d --name mydev-stag -p ${params.STAGING_PORT}:${APP_PORT} \\
              -e NODE_ENV=production \\
              -e PORT=${APP_PORT} \\
              ${IMAGE}

            echo "[Deploy] inside docker ps :"
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Deploy] Test is in quueu for Testing Health"
            for i in {1..30}; do
              if docker run --rm --network container:mydev-stag curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:mydev-stag curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:mydev-stag curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                echo "[Deploy] Health Testing done "
                docker logs --tail=80 mydev-stag || true
                exit 0
              fi
              echo "  not even healthy!!! (\$i/30)"
              sleep 1
            done

            echo "[Deploy] Failed for Health testing "
            docker logs --tail=300 mydev-stag || true
            exit 1
          """
        }
      }
    }

    stage('Release Stage') {
      steps {
        script {
          def IMAGE = "mydev-ci:${env.BUILD_NUMBER}"
          sh """#!/bin/bash
            set -euo pipefail

            echo "[Release] Production container is cleaned"
            docker rm -f mydev-prod || true

            echo "[Release] Production container run through ${IMAGE}"
            docker run -d --name mydev-prod -p ${params.PROD_PORT}:${APP_PORT} \\
              -e NODE_ENV=production \\
              -e PORT=${APP_PORT} \\
              ${IMAGE}

            echo "[Release] the docker ps : "
            docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'

            echo "[Release] Production health is in queue"
            for i in {1..30}; do
              if docker run --rm --network container:mydev-prod curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:mydev-prod curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                 docker run --rm --network container:mydev-prod curlimages/curl:8.10.1 \\
                   -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                echo "[Release] PRODUCTION Healthy "
                docker logs --tail=80 mydev-prod || true
                exit 0
              fi
              echo " not healthy (\$i/30)"
              sleep 1
            done

            echo "[Release] failed detected any health Production"
            docker logs --tail=300 mydev-prod || true
            exit 1
          """
        }
      }
    }

    stage('Monitoring Stage') {
      steps {
        sh '''#!/bin/bash
          set -euo pipefail
          echo "[Monitoring] Production container is checking inside the container"

          HEALTH1="http://localhost:${APP_PORT}/health"
          HEALTH2="http://localhost:${APP_PORT}/api/health"
          HEALTH3="http://localhost:${APP_PORT}/"

          if docker exec mydev-prod sh -c "wget -qO- $HEALTH1 >/dev/null 2>&1" || \
             docker exec mydev-prod sh -c "wget -qO- $HEALTH2 >/dev/null 2>&1" || \
             docker exec mydev-prod sh -c "wget -qO- $HEALTH3 >/dev/null 2>&1"; then
            echo "[Monitoring] Health is Good"
          else
            echo "[Monitoring] Health is Failed "
            docker logs --tail=120 mydev-prod || true
            exit 1
          fi

          echo "[Monitoring] the stats of Container "
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
