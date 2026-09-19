import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.AUTH_SECRET || 'khilona-point-secret-key-change-in-prod';
export function generateToken(user) {
    return jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
    }, JWT_SECRET, { expiresIn: '7d' });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (err) {
        return null;
    }
}
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required. Please login.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired session token.' });
        return;
    }
    req.user = payload;
    next();
}
