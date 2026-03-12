import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// ПІДКЛЮЧЕННЯ ДО БАЗИ
const pool = new pg.Pool({
    connectionString: process.env.DB_URL,
    ssl: { rejectUnauthorized: false }
});

// НАЛАШТУВАННЯ (Важливо: рядок static має бути першим)
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ОБРОБКА РЕЄСТРАЦІЇ
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [username, email, hashedPassword, 'user']
        );
        res.status(200).send('Успішно зареєстровано!');
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            res.status(400).send('Цей email або логін вже зайняті.');
        } else {
            res.status(500).send('Помилка бази даних.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер працює: http://localhost:${PORT}`);
});