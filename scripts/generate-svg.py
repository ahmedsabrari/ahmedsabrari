#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

class SVGGenerator:
    def __init__(self, data_file):
        with open(data_file, 'r') as f:
            self.data = json.load(f)
        
        self.theme = {
            "background": "#0D1117",
            "primary": "#58A6FF",
            "secondary": "#8B949E",
            "text": "#C9D1D9",
            "border": "#30363D",
            "radical": {
                "bg": "#0D1117",
                "title": "#FF6B6B",
                "icon": "#4ECDC4",
                "text": "#F8F9FA",
                "border": "#FFE66D"
            }
        }
    
    def create_svg_root(self, width, height):
        svg = ET.Element('svg', {
            'xmlns': 'http://www.w3.org/2000/svg',
            'width': str(width),
            'height': str(height),
            'viewBox': f'0 0 {width} {height}'
        })
        
        # Add background
        bg = ET.SubElement(svg, 'rect', {
            'width': '100%',
            'height': '100%',
            'fill': self.theme['radical']['bg'],
            'rx': '10',
            'ry': '10'
        })
        
        return svg
    
    def add_text(self, parent, x, y, text, size=16, color=None, weight='normal'):
        if color is None:
            color = self.theme['radical']['text']
        
        txt = ET.SubElement(parent, 'text', {
            'x': str(x),
            'y': str(y),
            'font-family': 'Segoe UI, Ubuntu, sans-serif',
            'font-size': str(size),
            'font-weight': weight,
            'fill': color
        })
        txt.text = str(text)
        return txt
    
    def generate_overview_svg(self):
        user = self.data.get('user', {})
        totals = self.data.get('totals', {})
        
        width, height = 420, 200
        svg = self.create_svg_root(width, height)
        
        # Title
        self.add_text(svg, 20, 40, "GitHub Stats", 24, self.theme['radical']['title'], 'bold')
        
        # Stats
        stats = [
            ("Public Repos", user.get('public_repos', 0)),
            ("Followers", user.get('followers', 0)),
            ("Following", user.get('following', 0)),
            ("Total Stars", totals.get('stars', 0)),
            ("Total Forks", totals.get('forks', 0)),
            ("⭐/Repo", round(totals.get('stars', 0) / max(user.get('public_repos', 1), 1), 1))
        ]
        
        y = 80
        for label, value in stats:
            self.add_text(svg, 30, y, f"{label}:", 16, self.theme['radical']['text'])
            self.add_text(svg, 180, y, str(value), 16, self.theme['primary'], 'bold')
            y += 25
        
        # Footer
        self.add_text(svg, width - 120, height - 10, 
                     f"Updated: {datetime.now().strftime('%Y-%m-%d')}", 
                     10, self.theme['secondary'])
        
        return self.prettify(svg)
    
    def generate_streak_svg(self):
        streak = self.data.get('streak', {})
        contributions = self.data.get('contributions', {})
        
        width, height = 420, 200
        svg = self.create_svg_root(width, height)
        
        # Title
        self.add_text(svg, 20, 40, "Contribution Streak", 24, self.theme['radical']['title'], 'bold')
        
        # Streak stats
        self.add_text(svg, 30, 80, "Current Streak:", 16, self.theme['radical']['text'])
        self.add_text(svg, 180, 80, f"{streak.get('current', 0)} days", 16, self.theme['primary'], 'bold')
        
        self.add_text(svg, 30, 110, "Longest Streak:", 16, self.theme['radical']['text'])
        self.add_text(svg, 180, 110, f"{streak.get('longest', 0)} days", 16, "#FFD700", 'bold')
        
        self.add_text(svg, 30, 140, "Total Contributions:", 16, self.theme['radical']['text'])
        self.add_text(svg, 180, 140, str(contributions.get('totalCommitContributions', 0)), 
                     16, "#4ECDC4", 'bold')
        
        # Calendar summary
        if contributions.get('contributionCalendar'):
            total = contributions['contributionCalendar']['totalContributions']
            self.add_text(svg, 30, 170, f"All-time: {total} contributions", 
                         14, self.theme['secondary'])
        
        return self.prettify(svg)
    
    def generate_top_langs_svg(self):
        languages = self.data.get('languages', {})
        
        width, height = 420, 200
        svg = self.create_svg_root(width, height)
        
        # Title
        self.add_text(svg, 20, 40, "Top Languages", 24, self.theme['radical']['title'], 'bold')
        
        # Sort languages by usage
        sorted_langs = sorted(languages.items(), key=lambda x: x[1], reverse=True)[:8]
        total_repos = sum(languages.values())
        
        y = 80
        for lang, count in sorted_langs:
            percentage = (count / total_repos) * 100 if total_repos > 0 else 0
            
            # Language name
            self.add_text(svg, 30, y, lang, 16, self.theme['radical']['text'])
            
            # Bar
            bar_width = 250
            fill_width = int((percentage / 100) * bar_width)
            
            bar_bg = ET.SubElement(svg, 'rect', {
                'x': '150',
                'y': str(y - 12),
                'width': str(bar_width),
                'height': '15',
                'fill': self.theme['border'],
                'rx': '5',
                'ry': '5'
            })
            
            bar_fill = ET.SubElement(svg, 'rect', {
                'x': '150',
                'y': str(y - 12),
                'width': str(fill_width),
                'height': '15',
                'fill': self.theme['primary'],
                'rx': '5',
                'ry': '5'
            })
            
            # Percentage
            self.add_text(svg, 410, y, f"{percentage:.1f}%", 14, self.theme['secondary'])
            
            y += 25
        
        return self.prettify(svg)
    
    def generate_repo_pin_svg(self, repo_data):
        width, height = 320, 150
        svg = self.create_svg_root(width, height)
        
        # Repo name (truncate if too long)
        repo_name = repo_data.get('name', '')
        display_name = repo_name[:20] + '...' if len(repo_name) > 20 else repo_name
        
        self.add_text(svg, 20, 40, display_name, 20, self.theme['radical']['title'], 'bold')
        
        # Description
        desc = repo_data.get('description', 'No description')
        if desc:
            desc = desc[:50] + '...' if len(desc) > 50 else desc
            self.add_text(svg, 20, 70, desc, 12, self.theme['radical']['text'])
        
        # Stats
        y = 100
        stats = [
            ("⭐", repo_data.get('stargazers_count', 0)),
            ("🍴", repo_data.get('forks_count', 0)),
            ("👁️", repo_data.get('watchers_count', 0)),
            ("📝", repo_data.get('open_issues_count', 0))
        ]
        
        x = 20
        for icon, value in stats:
            self.add_text(svg, x, y, f"{icon} {value}", 14, self.theme['secondary'])
            x += 70
        
        # Language
        lang = repo_data.get('language', 'N/A')
        self.add_text(svg, 20, 130, f"Language: {lang}", 12, self.theme['primary'])
        
        # Updated date
        updated = repo_data.get('updated_at', '')
        if updated:
            date = datetime.strptime(updated, '%Y-%m-%dT%H:%M:%SZ').strftime('%b %d, %Y')
            self.add_text(svg, 200, 130, f"Updated: {date}", 10, self.theme['secondary'])
        
        return self.prettify(svg)
    
    def prettify(self, element):
        rough_string = ET.tostring(element, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ")
    
    def save_all_svgs(self, output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
        # Overview stats
        overview_svg = self.generate_overview_svg()
        with open(os.path.join(output_dir, 'overview.svg'), 'w') as f:
            f.write(overview_svg)
        
        # Streak stats
        streak_svg = self.generate_streak_svg()
        with open(os.path.join(output_dir, 'streak.svg'), 'w') as f:
            f.write(streak_svg)
        
        # Top languages
        top_langs_svg = self.generate_top_langs_svg()
        with open(os.path.join(output_dir, 'top-langs.svg'), 'w') as f:
            f.write(top_langs_svg)
        
        # Repo pins
        repos_dir = os.path.join(output_dir, '..', 'repos')
        os.makedirs(repos_dir, exist_ok=True)
        
        popular_repos = self.get_popular_repos()
        for repo in popular_repos:
            repo_svg = self.generate_repo_pin_svg(repo)
            safe_name = repo['name'].replace('-', '_').lower()
            with open(os.path.join(repos_dir, f'{safe_name}_pin.svg'), 'w') as f:
                f.write(repo_svg)
        
        print(f"✅ SVGs saved to {output_dir}")
    
    def get_popular_repos(self, limit=4):
        repos = self.data.get('repositories', [])
        filtered = [r for r in repos if r.get('stargazers_count', 0) > 0]
        sorted_repos = sorted(filtered, key=lambda x: x.get('stargazers_count', 0), reverse=True)
        return sorted_repos[:limit]

def main():
    data_file = 'data/github-stats.json'
    
    if not os.path.exists(data_file):
        print(f"❌ Data file not found: {data_file}")
        print("Run the Node.js script first to fetch data from GitHub API")
        sys.exit(1)
    
    generator = SVGGenerator(data_file)
    generator.save_all_svgs('public/stats')

if __name__ == '__main__':
    main()