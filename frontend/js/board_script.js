// 게시글 렌더링
function renderPosts(posts) {
    const postListContainer = document.querySelector('.inbox-message ul');
    if (!postListContainer) {
        console.error('.inbox-message ul 요소를 찾을 수 없습니다.');
        return;
    }

    // posts가 undefined나 null일 경우 빈 배열로 처리
    if (!posts || !Array.isArray(posts)) {
        console.error('게시글 데이터가 유효하지 않습니다.');
        return;
    }

    const postList = posts.map(post => `
        <li>
            <a href="https://writespace-bucket.s3.ap-northeast-2.amazonaws.com/post_view.html?id=${post.post_id}">
                <div class="message-avatar">
                    <img src="https://bootdey.com/img/Content/avatar/avatar${post.post_id % 8}.png" alt>
                </div>
                <div class="message-body">
                    <div class="message-body-heading">
                        <h5>${post.author_nickname}</h5>
                        <span>${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <p>${post.title.substring(0, 50)}...</p>
                </div>
            </a>
        </li>
    `).join('');
    
    postListContainer.innerHTML = postList;
}

// 페이지네이션 렌더링
function updatePagination(currentPage, totalPages) {
    const paginationContainer = document.querySelector('.text-center');
    if (!paginationContainer) {
        console.error('.text-center 요소를 찾을 수 없습니다.');
        return;
    }

    paginationContainer.innerHTML = `
        <a href="#" class="btn btn-sm btn-success" onclick="loadPosts(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>이전</a>
        <span style="margin: 0 10px;">${currentPage} page / ${totalPages} pages</span>
        <a href="#" class="btn btn-sm btn-success" onclick="loadPosts(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>다음</a>
    `;
}

// 게시글 데이터 로드
async function loadPosts(page = 1, pageSize = 5) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`https://05h913xawi.execute-api.ap-northeast-2.amazonaws.com/default/writespace/posts?page=${page}&pageSize=${pageSize}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            }
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || '게시글을 불러오지 못했습니다.');
        }

        const result = await response.json();
        
        // posts가 유효하지 않은 경우 처리
        if (!result || !result.posts || !Array.isArray(result.posts)) {
            console.error('게시글 데이터가 유효하지 않습니다.');
            renderPosts([]);  // 빈 배열을 넘겨줘서 빈 목록을 렌더링
        } else {
            renderPosts(result.posts);
            
            // pagination이 유효한 경우에만 처리
            if (result.pagination && result.pagination.currentPage && result.pagination.totalPages) {
                updatePagination(result.pagination.currentPage, result.pagination.totalPages);
            } else {
                console.error('페이지 정보가 유효하지 않습니다.');
            }
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        alert(`게시글 로드 중 오류: ${error.message}`);
    }
}

// 검색 기능
document.getElementById('searchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const field = document.getElementById('searchField').value;
    const query = document.getElementById('searchInput').value;

    if (!field || !query) {
        alert('검색 필드와 검색어를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`https://05h913xawi.execute-api.ap-northeast-2.amazonaws.com/default/writespace/posts/search?field=${field}&query=${query}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            mode: 'cors'  // CORS 설정을 'cors'로 변경
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || '검색 결과를 불러오지 못했습니다.');
        }

        const result = await response.json();
        renderPosts(result.posts);
    } catch (error) {
        console.error('Error searching posts:', error);
        alert(`검색 중 오류: ${error.message}`);
    }
});

// DOM 로드 시 첫 페이지 게시글 불러오기
document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('nickname').textContent = `${user.nickname}님`;
    } else {
        alert('로그인이 필요합니다.');
        window.location.href = 'https://writespace-bucket.s3.ap-northeast-2.amazonaws.com/index.html';
    }

    await loadPosts();
});

// 로그아웃 처리
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    alert('로그아웃되었습니다.');
    window.location.href = 'https://writespace-bucket.s3.ap-northeast-2.amazonaws.com/index.html';
}