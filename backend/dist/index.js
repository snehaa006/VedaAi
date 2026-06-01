"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const websocket_1 = require("./services/websocket");
const queue_1 = require("./services/queue");
const assignments_1 = __importDefault(require("./routes/assignments"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const allowedOrigins = new Set([
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3002',
]);
// Middleware
app.use((0, helmet_1.default)({ crossOriginEmbedderPolicy: false }));
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '20mb' }));
// Routes
app.use('/api/assignments', assignments_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Init WebSocket
(0, websocket_1.initWebSocket)(server);
// Connect to MongoDB and start
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vedaai';
mongoose_1.default
    .connect(MONGODB_URI)
    .then(() => {
    console.log('✅ MongoDB connected');
    (0, queue_1.startWorker)();
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})
    .catch((err) => {
    console.error('MongoDB connection error:', err);
    // Start server anyway (for development without MongoDB)
    (0, queue_1.startWorker)();
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (without DB)`);
    });
});
exports.default = app;
