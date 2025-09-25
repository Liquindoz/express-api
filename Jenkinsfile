pipeline {
  agent any
  options { timestamps() }

  tools {
    nodejs 'Node 20'                // Jenkins > Global Tool Configuration
  }

  environment {
    SCANNER_HOME = tool 'SonarScanner' // Jenkins > Global Tool Configuration
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
        sh '''
          export NODE_OPTIONS=--experimental-vm-modules
          npx jest --coverage --coverageReporters=lcov --coverageReporters=text
        '''

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
            cat audit.json | head -n 200
            exit 1
          else
            echo "No high/critical vulnerabilities found."
          fi
        '''

        archiveArtifacts artifacts: 'audit.json', fingerprint: true
      }
    }
  }
}
