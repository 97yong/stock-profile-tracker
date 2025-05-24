// 조회수 관리 클래스
class ViewCounter {
    constructor() {
        this.repoOwner = 'yongchae'; // GitHub 사용자명
        this.repoName = 'stock_tracker'; // 저장소 이름
        this.filePath = 'view-count.json';
        this.init();
    }

    async init() {
        try {
            await this.updateViews();
            await this.updateDisplay();
        } catch (error) {
            console.error('Failed to update view count:', error);
        }
    }

    async getViews() {
        try {
            const response = await fetch(`https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/${this.filePath}`);
            if (!response.ok) {
                // 파일이 없으면 초기 데이터 반환
                return { today: 0, total: 0, lastReset: new Date().toDateString() };
            }
            return response.json();
        } catch (error) {
            console.error('Failed to get views:', error);
            return { today: 0, total: 0, lastReset: new Date().toDateString() };
        }
    }

    async updateViews() {
        try {
            const views = await this.getViews();
            const today = new Date().toDateString();

            // 날짜가 바뀌었으면 오늘 조회수 초기화
            if (views.lastReset !== today) {
                views.today = 0;
                views.lastReset = today;
            }

            // 조회수 증가
            views.today++;
            views.total++;

            // GitHub API를 통해 파일 업데이트
            const token = 'YOUR_GITHUB_TOKEN'; // GitHub Personal Access Token
            const content = btoa(JSON.stringify(views, null, 2));
            
            // 파일이 있는지 확인
            const checkResponse = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });

            let sha;
            if (checkResponse.ok) {
                const fileData = await checkResponse.json();
                sha = fileData.sha;
            }

            // 파일 업데이트 또는 생성
            await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Update view count',
                    content: content,
                    sha: sha
                })
            });

            return views;
        } catch (error) {
            console.error('Failed to update views:', error);
            return { today: 0, total: 0, lastReset: new Date().toDateString() };
        }
    }

    async updateDisplay() {
        try {
            const views = await this.getViews();
            const todayCount = document.querySelector('.today-count');
            const totalCount = document.querySelector('.total-count');

            if (todayCount && totalCount) {
                todayCount.textContent = views.today.toLocaleString();
                totalCount.textContent = views.total.toLocaleString();
            }
        } catch (error) {
            console.error('Failed to update display:', error);
        }
    }
}

// ViewCounter 인스턴스 생성
const viewCounter = new ViewCounter(); 