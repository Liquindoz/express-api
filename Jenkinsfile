pipeline {
    agent any
    options { timestamps() }

    tools {
        // Must match what you configured in Jenkins > Global Tool Configuration
        nodejs 'Node 20'
    }

    environment {
        // Must match the SonarScanner name you configured in Jenkins
        SCANNER_HOME = tool 'SonarScanner'
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
                sh 'npm install'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Code Quality') {
            steps {
                withSonarQubeEnv('sonarqube') {
                    sh '''${SCANNER_HOME}/bin/sonar-scanner \
                      -Dsonar.projectKey=express-api \
                      -Dsonar.sources=src \
                      -Dsonar.tests=tests \
                      -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                      -Dsonar.host.url=http://host.docker.internal:9000 \
                      -Dsonar.login=$SONAR_TOKEN'''
                }
            }
        }
    }
}
