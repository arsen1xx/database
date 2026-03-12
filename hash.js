import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

dotenv.config(); // Оцей рядок каже програмі: "Шукай файл .env і читай його"

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
   connectionString: process.env.DB_URL,
   ssl: {
      rejectUnauthorized: false
   }
});

// 1. Ініціалізація бази: створюємо таблицю користувачів
const initializeDatabase = async () => {
   console.log('🔄️ Перевірка та ініціалізація бази даних...');

   const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,                    
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,       
    role TEXT DEFAULT 'user',            
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
  `;
   try {
      await pool.query(createTableQuery);
      console.log('✅ Таблиця "users" готова до роботи.');
   } catch (error) {
      console.error('❗ Помилка ініціалізації:', error.message);
      throw error;
   }
};

// 2. INSERT — Додавання нового користувача (З ХЕШУВАННЯМ ПАРОЛЯ)
async function addUser(username, email, plainPassword, role) {
   // Хешуємо пароль перед збереженням (10 - це рівень складності хешування)
   const saltRounds = 10;
   const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

   const query = `
        INSERT INTO users (
            username, email, password_hash, role
        )
        VALUES ($1, $2, $3, $4) 
        RETURNING id, username, email, role, created_at`; 
        // Повертаємо все, ОКРІМ пароля, щоб не світити його в консолі

   const values = [username, email, hashedPassword, role || 'user'];

   try {
      const res = await pool.query(query, values);
      console.log('✅ Користувача успішно створено!');
      console.log('Деталі:', res.rows[0]);
   } catch (err) {
      console.error('❗ Помилка при додаванні (можливо, такий email вже є):', err.message);
   }
}

// 3. SELECT — Перегляд усіх користувачів
async function getAllUsers() {
   // Навмисно не виводимо password_hash для безпеки
   const res = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC');
   console.log('✨ Список користувачів:');
   console.table(res.rows);
}

// 4. UPDATE — Оновлення інформації (крім пароля, для простоти)
async function updateUserInfo(id, updates) {
   const allowedFields = ['username', 'email', 'role'];

   const fields = [];
   const values = [id];

   updates.forEach((item, index) => {
      const [key, value] = item.split('=');

      if (!allowedFields.includes(key)) return;

      fields.push(`${key} = $${index + 2}`);
      values.push(value);
   });

   if (fields.length === 0) {
       return console.log('❗ Немає дозволених полів для оновлення.');
   }

   const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING id, username, email, role`;

   try {
       const res = await pool.query(query, values);
       console.log('✅ Дані користувача оновлено:', res.rows[0]);
   } catch (err) {
       console.error('❗ Помилка при оновленні:', err.message);
   }
}

// 5. DELETE — Видалення користувача
async function deleteUser(id) {
   try {
       await pool.query('DELETE FROM users WHERE id = $1', [id]);
       console.log(`✅ Користувача з ID ${id} видалено з бази.`);
   } catch (err) {
       console.error('❗ Помилка видалення:', err.message);
   }
}

// Основна логіка: обробка команд з консолі
const run = async () => {
    // Спочатку перевіряємо чи є таблиця (можна закоментувати, коли таблиця точно є)
    await initializeDatabase(); 

    switch (process.argv[2]) {
       case 'list':
          await getAllUsers();
          break;
       case 'add':
          // argv[3] = username, argv[4] = email, argv[5] = password, argv[6] = role
          await addUser(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
          break;
       case 'update':
          await updateUserInfo(process.argv[3], process.argv.slice(4));
          break;
       case 'delete':
          await deleteUser(process.argv[3]);
          break;
       case 'help':
       default:
          console.log('_______________________________________');
          console.log('🔴 Доступні команди:');
          console.log('1️⃣  list   - Показати всіх користувачів');
          console.log('2️⃣  add    - Додати: node app.js add <username> <email> <password> <role>');
          console.log('3️⃣  update - Оновити: node app.js update <id> username="..." email="..."');
          console.log('4️⃣  delete - Видалити: node app.js delete <id>');
          console.log('5️⃣  help   - Показати це меню');
          console.log('_______________________________________');
          break;
    }
    
    // Закриваємо з'єднання, щоб програма не висіла в терміналі
    pool.end(); 
};

run();