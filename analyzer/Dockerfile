FROM node:20-alpine
WORKDIR /usr/src/app

# Copy the **existing** file (analyzer.js) and lockfile
COPY analyzer.js package*.json ./

RUN npm install --production

CMD ["node", "analyzer.js"]
