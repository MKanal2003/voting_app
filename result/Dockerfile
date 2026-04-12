FROM node:18-slim

# Install curl (healthcheck) and tini (proper process management)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/app

# Install nodemon globally for dev (live reload)
RUN npm install -g nodemon

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install && \
    npm cache clean --force && \
    mv /usr/local/app/node_modules /node_modules

# Copy all app code
COPY . .

ENV PORT=80
EXPOSE 80

# tini handles signals properly so the app shuts down cleanly
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
