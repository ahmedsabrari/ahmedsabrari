import os
import requests
from github import Github
import re

# المصادقة باستخدام token
g = Github(os.environ['GITHUB_TOKEN'])
username = "ahmedsabrari"  # استبدل باسم المستخدم الخاص بك

def get_total_stars():
    stars = 0
    for repo in g.get_user().get_repos():
        stars += repo.stargazers_count
    return stars

def get_total_commits_2025():
    # تحتاج إلى استخدام GitHub API مباشرة لهذا
    headers = {'Authorization': f'token {os.environ["GITHUB_TOKEN"]}'}
    query = f'https://api.github.com/search/commits?q=author:{username}+committer-date:>=2025-01-01'
    response = requests.get(query, headers=headers)
    data = response.json()
    return data.get('total_count', 0)

def get_total_prs():
    headers = {'Authorization': f'token {os.environ["GITHUB_TOKEN"]}'}
    query = f'https://api.github.com/search/issues?q=author:{username}+type:pr'
    response = requests.get(query, headers=headers)
    data = response.json()
    return data.get('total_count', 0)

def get_total_issues():
    headers = {'Authorization': f'token {os.environ["GITHUB_TOKEN"]}'}
    query = f'https://api.github.com/search/issues?q=author:{username}+type:issue'
    response = requests.get(query, headers=headers)
    data = response.json()
    return data.get('total_count', 0)

def get_contributed_repos():
    # هذه تحتاج إلى طريقة أكثر تعقيداً
    # يمكن استخدام GitHub Events API
    headers = {'Authorization': f'token {os.environ["GITHUB_TOKEN"]}'}
    query = f'https://api.github.com/users/{username}/events'
    response = requests.get(query, headers=headers)
    data = response.json()
    
    repos = set()
    for event in data:
        if 'repo' in event:
            repos.add(event['repo']['name'])
    
    return len(repos)

def update_readme():
    with open('README.md', 'r') as file:
        content = file.read()
    
    # الحصول على الإحصاءات
    stats = {
        'total_stars': get_total_stars(),
        'total_commits_2025': get_total_commits_2025(),
        'total_prs': get_total_prs(),
        'total_issues': get_total_issues(),
        'contributed_to': get_contributed_repos()
    }
    
    # تحديث المحتوى
    new_content = re.sub(
        r'total stars earned:.*\n.*total commits\(2025\):.*\n.*total prs:.*\n.*total issues:.*\n.*contributed to \(last year\):.*',
        f'total stars earned: {stats["total_stars"]}\n'
        f'total commits(2025): {stats["total_commits_2025"]}\n'
        f'total prs: {stats["total_prs"]}\n'
        f'total issues: {stats["total_issues"]}\n'
        f'contributed to (last year): {stats["contributed_to"]}',
        content
    )
    
    with open('README.md', 'w') as file:
        file.write(new_content)

if __name__ == '__main__':
    update_readme()