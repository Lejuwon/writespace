let isSubmitting = false; // 요청 상태 플래그

document.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) return; // 중복 요청 방지
    isSubmitting = true;

    const email = document.querySelector('input[name="email"]').value;
    const password = document.querySelector('input[name="password"]').value;

    try {
        const response = await fetch('https://05h913xawi.execute-api.ap-northeast-2.amazonaws.com/default/writespace/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login', // 액션 추가
                email,
                password,
            }),
        });

        const result = await response.json();
        console.log('Response:', result);

        if (response.ok) { // 성공 상태 코드 확인
            // JWT와 사용자 정보 저장
            localStorage.setItem('token', result.token); // JWT 저장
            localStorage.setItem('user', JSON.stringify(result.user)); // 사용자 정보 저장
            alert(`Welcome, ${result.user.nickname}!`);
            window.location.href = 'http://writespace-bucket.s3-website.ap-northeast-2.amazonaws.com/board.html';
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (error) {
        // console.error('Error:', error);
        // alert('An unexpected error occurred. Please try again.');
    } finally {
        isSubmitting = false; // 요청 완료 후 플래그 초기화
    }
});