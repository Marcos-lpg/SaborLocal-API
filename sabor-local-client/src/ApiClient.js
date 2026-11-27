import axios from 'axios';

// Configuración base de Axios apuntando a tu API de .NET local
const api = axios.create({
  baseURL: 'http://localhost:5037/api', // Asegúrate de que coincida con el puerto de tu Swagger
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;