pipeline {
    agent any
    options { 
        timestamps() 
    }

    tools { 
        nodejs 'Node 20' 
    }

    environment {
        SCANNER_HOME = tool 'SonarScanner'
        HOST_PORT    = '8082' // external port
        APP_PORT     = '3000' // internal port
    }

    stages {
        stage('Checking out the SCM') {
            steps {
                git branch: 'main', url: 'https://github.com/Liquindoz/express-api.git'
            }
        }

        stage('Build stage') {
            steps {
                sh '''#!/bin/bash
                set -euo pipefail
                node -v && npm -v
                if [ -f package-lock.json ]; then
                    npm ci
                else
                    npm install
                fi
                '''
            }
        }

        stage('Test stage') {
            steps {
                sh '''#!/bin/bash
                set -euo pipefail
                export NODE_OPTIONS=--experimental-vm-modules
                npx jest --runInBand
                '''
            }
        }

        stage('Code Analysis stage') {
            steps {
                sh '''#!/bin/bash
                set -euo pipefail
                export NODE_OPTIONS=--experimental-vm-modules
                npx jest --coverage --coverageReporters=lcov --coverageReporters=text
                '''
                withSonarQubeEnv('sonarqube') {
                    sh """#!/bin/bash
                    set -euo pipefail
                    \${SCANNER_HOME}/bin/sonar-scanner \\
                        -Dsonar.projectKey=express-api \\
                        -Dsonar.projectName=express-api \\
                        -Dsonar.sources=src \\
                        -Dsonar.tests=tests \\
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                    """
                }
            }
        }

        stage('Security stage') {
            steps {
                sh '''#!/bin/bash
                set -euo pipefail
                npm audit --audit-level=high --json > audit.json || true
                if grep -q '"severity":"\\(high\\|critical\\)"' audit.json; then
                    echo "Vulnerabilities are found"
                    head -n 150 audit.json || true
                    exit 1
                else
                    echo "No Vulnerabilities detect"
                fi
                '''
                archiveArtifacts artifacts: 'audit.json', fingerprint: true
            }
        }

        stage('Deploy stage') {
            steps {
                script {
                    def IMAGE = "express-api:${env.BUILD_NUMBER}"
                    sh """#!/bin/bash
                    set -euo pipefail
                    docker rm -f express-api-test || true
                    echo "[Deploy] Build in image ${IMAGE}"
                    docker build --pull -t ${IMAGE} .
                    echo "[Deploy] Begin to testing container through host:${HOST_PORT} -> app:${APP_PORT}"
                    docker run -d --name express-api-test -p ${HOST_PORT}:${APP_PORT} \\
                        -e NODE_ENV=production \\
                        -e PORT=${APP_PORT} \\
                        ${IMAGE}
                    echo "[Deploy] in the docker ps :"
                    docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'
                    echo "[Deploy] Test health is in queue inside netns container"
                    for i in {1..60}; do
                        if docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                            -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                           docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                            -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                           docker run --rm --network container:express-api-test curlimages/curl:8.10.1 \\
                            -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                            echo "[Deploy] Testing Healty"
                            docker logs --tail=80 express-api-test || true
                            exit 0
                        fi
                        echo " Not even Healthy (\$i/60)"
                        sleep 1
                    done
                    echo "[Deploy] Healthy test is Failed!!!"
                    docker logs --tail=300 express-api-test || true
                    exit 1
                    """
                }
            }
        }

        stage('Release stage') {
            steps {
                script {
                    def IMAGE = "express-api:${env.BUILD_NUMBER}"
                    sh """#!/bin/bash
                    set -euo pipefail
                    echo "[Release] Old Production is cleaned "
                    docker rm -f express-api-prod || true
                    echo "[Release] Production container is running through ${IMAGE}"
                    docker run -d --name express-api-prod -p 9090:${APP_PORT} \\
                        -e NODE_ENV=production \\
                        -e PORT=${APP_PORT} \\
                        ${IMAGE}
                    echo "[Release] in the docker ps:"
                    docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}\\t{{.Status}}'
                    echo "[Release] Production health is queue inside netns container "
                    for i in \$(seq 1 60); do
                        if docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \\
                            -fsS http://localhost:${APP_PORT}/health >/dev/null 2>&1 || \\
                           docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \\
                            -fsS http://localhost:${APP_PORT}/api/health >/dev/null 2>&1 || \\
                           docker run --rm --network container:express-api-prod curlimages/curl:8.10.1 \\
                            -fsS http://localhost:${APP_PORT}/ >/dev/null 2>&1; then
                            echo "[Release] Confirmed Healthy Of Production "
                            docker logs --tail=100 express-api-prod || true
                            exit 0
                        fi
                        echo " Not even Healthy(\$i/60)"
                        sleep 1
                    done
                    echo "[Release] health production is Failed"
                    docker logs --tail=250 express-api-prod
                    exit 1
                    """
                }
            }
        }

        stage('Monitor and Alert stage') {
            steps {
                sh '''#!/bin/bash
                set -euo pipefail
                echo "[Monitoring] Production is being check inside wget container"
                HEALTH1="http://localhost:${APP_PORT}/health"
                HEALTH2="http://localhost:${APP_PORT}/api/health"
                HEALTH3="http://localhost:${APP_PORT}/"
                if docker exec express-api-prod sh -c "wget -qO- $HEALTH1 >/dev/null 2>&1" || \
                   docker exec express-api-prod sh -c "wget -qO- $HEALTH2 >/dev/null 2>&1" || \
                   docker exec express-api-prod sh -c "wget -qO- $HEALTH3 >/dev/null 2>&1"; then
                    echo "[Monitoring] Health is good!"
                else
                    echo "[Monitoring] Health is Failed "
                    docker logs --tail=120 express-api-prod || true
                    exit 1
                fi
                echo "[Monitoring] The stats of Container"
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
