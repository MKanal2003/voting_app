pipeline {
    agent any

    environment {
        DOCKER_USERNAME = "arjunak"
    }

    stages {

        stage('Build Vote Image') {
            steps {
                sh 'docker build -t $DOCKER_USERNAME/vote:jenkins ./vote'
            }
        }

        stage('Build Result Image') {
            steps {
                sh 'docker build -t $DOCKER_USERNAME/result:jenkins ./result'
            }
        }

        stage('Build Worker Image') {
            steps {
                sh 'docker build -t $DOCKER_USERNAME/worker:jenkins ./worker'
            }
        }

        stage('Docker Images') {
            steps {
                sh 'docker images'
            }
        }
    }
}