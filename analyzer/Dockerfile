# Assuming a base image like this
FROM node:20-alpine

# ✅ BEST PRACTICE: Add curl for consistent health checks
RUN apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY analyzer.js ./

CMD [ "node", "analyzer.js" ]
