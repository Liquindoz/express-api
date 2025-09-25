pipeline {
  agent any
  options { timestamps() }

  tools {
    // You already created this in Manage Jenkins → Global Tool Configuration
    nodejs 'Node 20'
  }

  environment {
    // Name must match the Scanner you added in Global Tool Configuration
    SCANNER_HOME = tool 'SonarScanner'
  }

  stages {
    stage('Checkout SCM') {
      steps {
        // If your job is already “Pipeline from SCM”, Jenkins will do checkout for you.
        // Keeping this is harmless; remove if you prefer the job’s SCM config.
        git branch: 'main', url: 'https://github.com/Liquindoz/express-api.git'
      }
    }

    stage('Build') {
      steps {
        sh 'node -v && npm -v'
        sh
