pipeline {
    agent any

    environment {
        DOCKER_USERNAME = "arjunak"
    }

    stages {

        stage('Clone Repository') {
            steps {
                git 'https://github.com/MKanal2003/voting_app.git'
            }
        }

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