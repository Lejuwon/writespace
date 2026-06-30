const mysql = require('mysql2/promise');

// 환경 변수에서 데이터베이스 설정 가져오기
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

exports.handler = async (event) => {
    console.log('Full event received:', JSON.stringify(event, null, 2)); // 요청 전체 로그

    const commonHeaders = {
        'Access-Control-Allow-Origin': 'http://writespace-bucket.s3-website.ap-northeast-2.amazonaws.com', // 허용할 도메인
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',  // 허용할 메소드 추가
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 허용할 헤더
    };

    // OPTIONS 요청 처리
    if (event.httpMethod === 'OPTIONS') {
        console.info('Handling OPTIONS request');
        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ message: 'Preflight OK' }),
        };
    }

    if (event.httpMethod === 'GET') {
        // GET 요청 처리
        return {
            statusCode: 200,
            headers: commonHeaders, // CORS 헤더 포함
            body: JSON.stringify({ message: 'GET request processed successfully' }),
        };
    }

    // 다른 요청 처리 (GET, POST 등)
    if (['GET', 'POST'].includes(event.httpMethod)) {
        const path = event.resource || event.path;
        const queryParams = event.queryStringParameters || {};
        
        // GET 요청 처리 (게시글 조회)
        if (event.httpMethod === 'GET' && path === '/writespace/posts') {
            if (!queryParams.postId) {
                console.info('Handling GET request for all posts');
                return await getPostsHandler(event, commonHeaders);
            } else {
                console.info('Handling GET request for a specific post');
                // 특정 게시글 조회
                // return await handleGetPostById(event, commonHeaders);
            }
        }

        // POST 요청 처리 (예: signup, login 등)
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
                // 추가 액션 핸들러를 여기에 정의
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
    }

    // 잘못된 HTTP 메소드 요청 처리
    return {
        statusCode: 405, // Method Not Allowed
        headers: commonHeaders,
        body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
};
const jwt = require('jsonwebtoken'); // JWT 모듈 추가

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables.');
}

// 로그인 처리 함수
async function handleLogin(parsedBody) {
    const { email, password } = parsedBody;
    let connection;

    try {
        // 데이터베이스 연결
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 필수 값 확인
        if (!email || !password) {
            console.log('Missing email or password.');
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Email and password are required for login.' }),
            };
        }

        // 사용자 검증 (이메일 및 비밀번호 확인)
        const [rows] = await connection.execute(
            'SELECT user_id, email, name, nickname, role FROM users WHERE email = ? AND password = ?',
            [email, password]
        );

        if (rows.length === 0) {
            console.log('Invalid email or password.');
            return {
                statusCode: 401,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Invalid email or password.' }),
            };
        }

        const user = rows[0];
        console.log('User authenticated successfully:', user);

        // JWT 토큰 생성
        const token = jwt.sign(
            {
                id: user.user_id,
                email: user.email,
                nickname: user.nickname,
                role: user.role,
            },
            JWT_SECRET,
            { expiresIn: '1h' } // 토큰 만료 시간 (1시간)
        );

        console.log('JWT token generated:', token);

        // 성공 응답
        return {
            statusCode: 200,
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true', // CORS 설정 (쿠키 저장용)
            },
            body: JSON.stringify({
                message: 'Login successful!',
                token, // 토큰 반환
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
        // 데이터베이스 연결
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 필수 값 확인
        if (!email || !password || !name || !nickname) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'All fields are required for signup.' }),
            };
        }

        // 이메일 중복 확인
        const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM users WHERE email = ?', [email]);
        if (rows[0].count > 0) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Email already registered.' }),
            };
        }

        // 사용자 등록
        const [result] = await connection.execute(
            'INSERT INTO users (email, password, name, nickname, role) VALUES (?, ?, ?, ?, ?)',
            [email, password, name, nickname, 'USER']
        );

        if (result.affectedRows > 0) {
            console.log('User registered successfully.');
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Signup successful!' }),
            };
        } else {
            console.error('Failed to register user.');
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


// 게시판 데이터 가져오기 - 게시판 메인
async function getPostsHandler(event) {
    console.log('Full event received:', JSON.stringify(event, null, 2)); // 요청 전체 로그

    // GET 요청인지 확인
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    // queryStringParameters에서 page와 pageSize 추출
    const queryParameters = event.queryStringParameters || {};
    const page = parseInt(queryParameters.page, 10) || 1; // 기본값: 1
    const pageSize = parseInt(queryParameters.pageSize, 10) || 5; // 기본값: 5
    const startRow = (page - 1) * pageSize + 1;
    const endRow = page * pageSize;

    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 게시글 목록 쿼리
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

        // 게시글 총 개수 조회
        const [countResult] = await connection.execute('SELECT COUNT(*) AS total FROM posts');
        const totalPosts = countResult[0].total;
        const totalPages = Math.ceil(totalPosts / pageSize);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                posts: rows,
                pagination: {
                    currentPage: page,
                    totalPages,
                },
            }),
        };
    } catch (error) {
        console.error('Error fetching posts:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}