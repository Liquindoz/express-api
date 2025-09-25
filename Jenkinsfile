pipeline {
  agent any
  options { timestamps() }

  tools {
    nodejs 'Node 20'                  // Jenkins > Global Tool Configuration
  }

  environment {
    SCANNER_HOME = tool 'SonarScanner' // Jenkins > Global Tool Configuration
    APP_PORT    = '3000'               // container listens on this port
    HOST_PORT   = '3000'               // host port you’ll open (change if busy)
  }

  stages {

    stage('Checkout SCM') {
      steps {
        // ok even if your job already does SCM checkout
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
        // generate coverage for Sonar
        sh '''
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --coverage --coverageReporters=lcov --coverageReporters=text
        '''

        // run SonarQube scanner (server name must match Manage Jenkins > System)
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
            # stop previous test container if it exists
            docker rm -f express-api-test || true

            # build image
            docker build -t ${IMAGE} .

            # run container (HOST_PORT -> APP_PORT)
            docker run -d --name express-api-test -p ${HOST_PORT}:${APP_PORT} ${IMAGE}

            # brief wait then health-check
            sleep 5
            curl -fsS http://localhost:${HOST_PORT}/health || (echo 'Health check failed' && docker logs express-api-test && exit 1)
          """
        }
      }
    }
  }

  post {
    always {
      // keep useful reports (ok if missing)
      archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true, fingerprint: true
    }
  }
}
