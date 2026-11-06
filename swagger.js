const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.0'});

const doc = {
    info: {
      title: 'FastFood API',
      description: 'Swagger delle api FastFood',
    },
    host: 'localhost:3005'
  };

const outputFile = './swagger.json';
const inputFiles = ['./main.js'];

swaggerAutogen(outputFile,inputFiles, doc);