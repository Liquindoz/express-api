pipeline {
  agent any
  options { timestamps(); ansiColor('xterm') }

  /* This tells Jenkins to install/use Node.js 20 for the build.
     You'll add this tool in Jenkins UI in step B. */
  tools { nodejs 'Node 20' }

  stages {
    stage('Build') {
      steps {
        sh 'node -v && npm -v'
        sh 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'
      }
    }

    stage('Test') {
      steps {
        sh 'npm test'
      }
    }
  }
}
