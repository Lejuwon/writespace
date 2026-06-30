const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken'); // JWT 모듈 추가

// 환경 변수에서 데이터베이스 설정 가져오기
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables.');
}

exports.handler = async (event) => {
    console.log('Full event received:', JSON.stringify(event, null, 2)); // 요청 전체 로그

    const commonHeaders = {
        'Access-Control-Allow-Origin': '*', // 허용할 도메인
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE', // 허용할 메소드 추가
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 허용할 헤더
    };

    // OPTIONS 요청 처리 (CORS Preflight 요청)
    if (event.httpMethod === 'OPTIONS') {
        console.info('Handling OPTIONS request');
        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ message: 'Preflight OK' }),
        };
    }

    // GET 요청 처리 (게시글 조회)
    if (event.httpMethod === 'GET' && event.path === '/writespace/posts') {
        return await getPostsHandler(event, commonHeaders);
    }

    // POST 요청 처리 (회원가입, 로그인)
    if (event.httpMethod === 'POST') {
        let parsedBody;
        if (event.body) {
            try {
                parsedBody = JSON.parse(event.body);
                console.info('Parsed Body:', parsedBody);
            } catch (error) {
                console.error('Invalid JSON format:', error.message);
                return {
                    statusCode: 400,
                    headers: commonHeaders,
                    body: JSON.stringify({ message: 'Invalid JSON format.' }),
                };
            }
        } else {
            console.error('Missing request body.');
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: JSON.stringify({ message: 'Request body is missing.' }),
            };
        }

        const { action } = parsedBody;
        if (!action) {
            console.error('Action parameter is missing.');
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: JSON.stringify({ message: 'Action parameter is missing.' }),
            };
        }

        console.info('Action:', action);
        const actionHandlers = {
            signup: handleSignup,
            login: handleLogin,
        };

        if (actionHandlers[action]) {
            return await actionHandlers[action](parsedBody);
        } else {
            console.error('Invalid action:', action);
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: JSON.stringify({ message: 'Invalid action.' }),
            };
        }
    }

    // 잘못된 HTTP 메소드 요청 처리
    return {
        statusCode: 405, // Method Not Allowed
        headers: commonHeaders,
        body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
};

// 로그인 처리 함수
async function handleLogin(parsedBody) {
    const { email, password } = parsedBody;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        if (!email || !password) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Email and password are required for login.' }),
            };
        }

        const [rows] = await connection.execute(
            'SELECT user_id, email, name, nickname, role FROM users WHERE email = ? AND password = ?',
            [email, password]
        );

        if (rows.length === 0) {
            return {
                statusCode: 401,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Invalid email or password.' }),
            };
        }

        const user = rows[0];
        const token = jwt.sign(
            {
                id: user.user_id,
                email: user.email,
                nickname: user.nickname,
                role: user.role,
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        return {
            statusCode: 200,
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true', 
            },
            body: JSON.stringify({
                message: 'Login successful!',
                token,
                user: {
                    id: user.user_id,
                    email: user.email,
                    name: user.name,
                    nickname: user.nickname,
                    role: user.role,
                },
            }),
        };
    } catch (error) {
        console.error('Error occurred during login:', error.message);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal server error.' }),
        };
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

// 회원가입 처리 함수
async function handleSignup(parsedBody) {
    const { email, password, name, nickname } = parsedBody;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        if (!email || !password || !name || !nickname) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'All fields are required for signup.' }),
            };
        }

        const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM users WHERE email = ?', [email]);
        if (rows[0].count > 0) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Email already registered.' }),
            };
        }

        const [result] = await connection.execute(
            'INSERT INTO users (email, password, name, nickname, role) VALUES (?, ?, ?, ?, ?)',
            [email, password, name, nickname, 'USER']
        );

        if (result.affectedRows > 0) {
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Signup successful!' }),
            };
        } else {
            return {
                statusCode: 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Failed to register user.' }),
            };
        }
    } catch (error) {
        console.error('Error occurred during signup:', error.message);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal server error.' }),
        };
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

// 게시글 가져오기 처리 함수
async function getPostsHandler(event, commonHeaders) {
    const queryParameters = event.queryStringParameters || {};
    const page = parseInt(queryParameters.page, 10) || 1;
    const pageSize = parseInt(queryParameters.pageSize, 10) || 5;
    const startRow = (page - 1) * pageSize + 1;
    const endRow = page * pageSize;

    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const query = `
            WITH NumberedPosts AS (
                SELECT 
                    p.post_id, 
                    p.title, 
                    p.content, 
                    p.author_id, 
                    p.created_at, 
                    u.nickname AS author_nickname,
                    ROW_NUMBER() OVER (ORDER BY p.created_at DESC) AS row_num
                FROM posts p
                JOIN users u ON p.author_id = u.user_id
            )
            SELECT * 
            FROM NumberedPosts
            WHERE row_num BETWEEN ? AND ?;
        `;
        const [rows] = await connection.execute(query, [startRow, endRow]);

        const [countResult] = await connection.execute('SELECT COUNT(*) AS total FROM posts');
        const totalPosts = countResult[0].total;
        const totalPages = Math.ceil(totalPosts / pageSize);

        return {
            statusCode: 200,
            headers: commonHeaders,  // CORS 헤더 포함
            body: JSON.stringify({
                posts: rows, 
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                },
            }),
        };
    } catch (error) {
        console.error('Error fetching posts:', error.message);
        return {
            statusCode: 500,
            headers: commonHeaders,  // CORS 헤더 포함
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

// 글 작성 저장 함수
async function handlePostRequest(event) {
    const { title, content } = parsedBody;
    let connection;

    const commonHeaders = {
        'Access-Control-Allow-Origin': '*', // 정확한 도메인 사용
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE', // 허용할 메소드 추가
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 허용할 헤더
    };

    try {
        // OPTIONS 요청 처리
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: commonHeaders,
                body: JSON.stringify({ message: 'CORS preflight request handled.' }),
            };
        }

        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        if (!title || !content) {
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: JSON.stringify({ message: 'Title and content are required for the post.' }),
            };
        }

        // 로그인 확인
        const userId = event.requestContext.authorizer.principalId; // JWT 토큰에서 사용자 정보 추출
        if (!userId) {
            return {
                statusCode: 401,
                headers: commonHeaders,
                body: JSON.stringify({ message: 'User not logged in.' }),
            };
        }

        // 글 데이터 삽입
        const [result] = await connection.execute(
            'INSERT INTO posts (title, content, user_id, created_at) VALUES (?, ?, ?, NOW())',
            [title, content, userId]
        );

        const postId = result.insertId;
        console.log('Post created with ID:', postId);

        // 성공 응답
        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ message: '새 글이 작성되었습니다.' }),
        };
    } catch (error) {
        console.error('Error occurred while creating post:', error.message);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal server error.' }),
        };
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}
