// MISTER Token Intelligence - Frontend JavaScript

class MisterApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:4000';
        this.tokenApiUrl = 'http://localhost:3456';
        this.currentSection = 'analysis';
        this.chatHistory = [];

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkApiStatus();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.handleNavigation(e.target.closest('.nav-item'));
            });
        });

        // Chat input
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        document.getElementById('sendButton').addEventListener('click', () => {
            this.sendMessage();
        });

        // Quick actions
        document.querySelectorAll('.quick-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const query = e.target.closest('.quick-action').dataset.query;
                this.processQuery(query);
            });
        });

        // Search functionality
        document.getElementById('tokenSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchToken(e.target.value);
            }
        });

        // Modal close
        document.getElementById('modalClose').addEventListener('click', () => {
            document.getElementById('analysisModal').style.display = 'none';
        });
    }

    handleNavigation(navItem) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to clicked item
        navItem.classList.add('active');

        // Toggle submenu
        const submenu = navItem.nextElementSibling;
        if (submenu && submenu.classList.contains('nav-submenu')) {
            navItem.classList.toggle('expanded');
            submenu.classList.toggle('expanded');
        }

        // Handle section change
        const section = navItem.dataset.section;
        if (section) {
            this.currentSection = section;
            this.loadSectionContent(section);
        }
    }

    async checkApiStatus() {
        const apis = [
            { name: 'Risk API', url: `${this.apiBaseUrl}/health`, element: 'risk-api' },
            { name: 'Token DB', url: `${this.tokenApiUrl}/health`, element: 'token-db' },
        ];

        for (const api of apis) {
            try {
                const response = await fetch(api.url);
                if (response.ok) {
                    this.updateApiStatus(api.name, true);
                } else {
                    this.updateApiStatus(api.name, false);
                }
            } catch (error) {
                this.updateApiStatus(api.name, false);
            }
        }
    }

    updateApiStatus(apiName, isOnline) {
        const statusElements = document.querySelectorAll('.api-item');
        statusElements.forEach(element => {
            if (element.textContent.includes(apiName)) {
                const dot = element.querySelector('.status-dot');
                if (isOnline) {
                    dot.classList.add('online');
                } else {
                    dot.classList.remove('online');
                }
            }
        });
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) return;

        // Add user message to chat
        this.addMessage('user', message);
        input.value = '';

        // Process the query
        await this.processQuery(message);
    }

    addMessage(sender, content, isHtml = false) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = sender === 'user' ? 'fa-user' : 'fa-shield-alt';
        const senderName = sender === 'user' ? 'You' : 'MISTER Assistant';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${avatar}"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender">${senderName}</span>
                    <span class="timestamp">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="message-text">
                    ${isHtml ? content : this.escapeHtml(content)}
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Store in chat history
        this.chatHistory.push({ sender, content, timestamp: new Date() });
    }

    async processQuery(query) {
        const lowerQuery = query.toLowerCase();

        try {
            // Show typing indicator
            this.addMessage('assistant', '🤔 Analyzing your request...', true);

            if (lowerQuery.includes('analyze') || lowerQuery.includes('risk')) {
                await this.handleTokenAnalysis(query);
            } else if (lowerQuery.includes('trending') || lowerQuery.includes('top')) {
                await this.handleTrendingTokens();
            } else if (lowerQuery.includes('cluster') || lowerQuery.includes('wallet')) {
                await this.handleClusterAnalysis(query);
            } else if (lowerQuery.includes('alert') || lowerQuery.includes('risky')) {
                await this.handleRiskAlerts();
            } else {
                await this.handleGeneralQuery(query);
            }
        } catch (error) {
            this.addMessage('assistant', `❌ Sorry, I encountered an error: ${error.message}`, true);
        }

        // Remove typing indicator
        const messages = document.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.textContent.includes('Analyzing your request')) {
            lastMessage.remove();
        }
    }

    async handleTokenAnalysis(query) {
        // Extract token from query
        const tokenMatch = query.match(/\b([A-Z]{2,10})\b/);
        const token = tokenMatch ? tokenMatch[1] : 'SNEK';

        try {
            // First get the policy ID for the token from token API
            const tokenResponse = await fetch(`${this.tokenApiUrl}/api/token/find?ticker=${token}`);
            const tokenData = await tokenResponse.json();

            if (!tokenData.success || !tokenData.token?.policyId) {
                this.addMessage('assistant', `❌ Could not find ${token} in database.`, true);
                return;
            }

            // Now get the risk analysis using the holders endpoint
            const analysisResponse = await fetch(`${this.apiBaseUrl}/analyze/${tokenData.token.policyId}/holders`);
            const analysisData = await analysisResponse.json();

            if (analysisData && analysisData.holders) {
                const riskScore = analysisData.metadata?.riskScore || 5;
                const riskColor = this.getRiskColor(riskScore);

                const analysisHtml = `
                    <div style="border-left: 4px solid ${riskColor}; padding-left: 15px;">
                        <h4 style="color: ${riskColor}; margin-bottom: 10px;">
                            ${token} Risk Analysis
                        </h4>
                        <div style="margin-bottom: 15px;">
                            <strong>Risk Score:</strong>
                            <span style="color: ${riskColor}; font-weight: bold;">
                                ${riskScore}/10
                            </span>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Total Holders:</strong> ${analysisData.totalHolders}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Top Holder:</strong> ${analysisData.metadata?.topHolderPercentage?.toFixed(2) || 'N/A'}%
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Infrastructure Wallets:</strong> ${analysisData.metadata?.infrastructureCount || 0}
                        </div>
                        <div style="margin-top: 20px;">
                            <button onclick="window.misterApp.showBubbleMap('${token}')"
                                    style="background: linear-gradient(135deg, #00d4ff, #0099cc);
                                           border: none;
                                           border-radius: 20px;
                                           padding: 10px 20px;
                                           color: white;
                                           cursor: pointer;
                                           font-weight: 600;">
                                🫧 View Bubble Map
                            </button>
                        </div>
                    </div>
                `;

                this.addMessage('assistant', analysisHtml, true);
            } else {
                this.addMessage('assistant', `❌ Could not analyze ${token}. Analysis failed.`, true);
            }
        } catch (error) {
            this.addMessage('assistant', `❌ Error analyzing ${token}: ${error.message}`, true);
        }
    }

    async handleTrendingTokens() {
        try {
            const response = await fetch(`${this.tokenApiUrl}/trending`);
            const data = await response.json();

            if (data.success && data.tokens) {
                const tokensHtml = `
                    <h4 style="color: #00d4ff; margin-bottom: 15px;">🔥 Trending Tokens</h4>
                    <div style="display: grid; gap: 10px;">
                        ${data.tokens.slice(0, 10).map(token => `
                            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border-left: 3px solid #00d4ff;">
                                <strong>${token.ticker}</strong> - Volume: ${token.volume || 'N/A'}
                                <br><small style="color: #888;">${token.unit?.substring(0, 20)}...</small>
                            </div>
                        `).join('')}
                    </div>
                `;
                this.addMessage('assistant', tokensHtml, true);
            } else {
                this.addMessage('assistant', '📊 No trending data available at the moment.', true);
            }
        } catch (error) {
            this.addMessage('assistant', `❌ Error fetching trending tokens: ${error.message}`, true);
        }
    }

    async handleClusterAnalysis(query) {
        const clusterHtml = `
            <h4 style="color: #00d4ff; margin-bottom: 15px;">🕸️ Wallet Cluster Analysis</h4>
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
                <p>Cluster analysis helps identify connected wallets that might be controlled by the same entity.</p>
                <br>
                <div style="margin-bottom: 10px;">
                    <strong>🔍 Detection Methods:</strong>
                    <ul style="margin-left: 20px; margin-top: 5px;">
                        <li>Stake address connections</li>
                        <li>Transaction patterns</li>
                        <li>Coordinated trading behavior</li>
                        <li>Funding source analysis</li>
                    </ul>
                </div>
                <div style="margin-top: 15px; padding: 10px; background: rgba(0,212,255,0.1); border-radius: 6px;">
                    💡 <strong>Tip:</strong> Use the visualization tools to see cluster relationships graphically!
                </div>
            </div>
        `;
        this.addMessage('assistant', clusterHtml, true);
    }

    async handleRiskAlerts() {
        const alertsHtml = `
            <h4 style="color: #ff4444; margin-bottom: 15px;">🚨 Risk Alerts</h4>
            <div style="display: grid; gap: 10px;">
                <div style="background: rgba(255,68,68,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #ff4444;">
                    <strong>High Risk Token Detected</strong><br>
                    <small>Token XYZ shows 85% holder concentration</small>
                </div>
                <div style="background: rgba(255,165,0,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #ffa500;">
                    <strong>Suspicious Cluster Activity</strong><br>
                    <small>Multiple wallets coordinated buying detected</small>
                </div>
                <div style="background: rgba(255,255,0,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #ffff00;">
                    <strong>New Token Alert</strong><br>
                    <small>ABC token requires risk assessment</small>
                </div>
            </div>
        `;
        this.addMessage('assistant', alertsHtml, true);
    }

    async handleGeneralQuery(query) {
        const helpHtml = `
            <h4 style="color: #00d4ff; margin-bottom: 15px;">🤖 MISTER Assistant</h4>
            <p>I can help you with:</p>
            <ul style="margin: 10px 0 10px 20px;">
                <li><strong>Token Analysis:</strong> "Analyze SNEK" or "Risk assessment for HOSKY"</li>
                <li><strong>Trending Data:</strong> "Show trending tokens" or "Top volume tokens"</li>
                <li><strong>Cluster Analysis:</strong> "Show wallet clusters" or "Detect connected wallets"</li>
                <li><strong>Risk Alerts:</strong> "Show risk alerts" or "Risky tokens today"</li>
                <li><strong>Market Intelligence:</strong> "Market overview" or "Safe tokens list"</li>
            </ul>
            <div style="margin-top: 15px; padding: 10px; background: rgba(0,212,255,0.1); border-radius: 6px;">
                💡 Try asking about specific tokens or use the quick action buttons below!
            </div>
        `;
        this.addMessage('assistant', helpHtml, true);
    }

    async searchToken(query) {
        if (!query.trim()) return;

        // Add search to chat
        this.addMessage('user', `Search: ${query}`);
        await this.handleTokenAnalysis(`analyze ${query}`);
    }

    getRiskColor(riskScore) {
        if (riskScore <= 3) return '#00ff88';
        if (riskScore <= 6) return '#ffaa00';
        return '#ff4444';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadInitialData() {
        // Load some initial trending data or stats
        setTimeout(() => {
            this.addMessage('assistant', `
                <div style="text-align: center; padding: 20px;">
                    <h3 style="color: #00d4ff; margin-bottom: 10px;">🎯 MISTER Intelligence Ready!</h3>
                    <p>Connected to all APIs and monitoring systems.</p>
                    <div style="margin-top: 15px; display: flex; justify-content: center; gap: 20px; font-size: 14px;">
                        <span>✅ Risk Analysis</span>
                        <span>✅ Token Database</span>
                        <span>✅ Live Monitoring</span>
                    </div>
                </div>
            `, true);
        }, 1000);
    }

    loadSectionContent(section) {
        // This would load different content based on the selected section
        console.log(`Loading content for section: ${section}`);
    }

    async showBubbleMap(token) {
        try {
            // Show loading state
            this.addMessage('assistant', `🫧 Loading bubble map for ${token}...`, true);

            // First get the policy ID for the token from token API
            const tickerResponse = await fetch(`${this.tokenApiUrl}/api/token/find?ticker=${token}`);
            const tickerData = await tickerResponse.json();

            if (!tickerData.success || !tickerData.token?.policyId) {
                this.addMessage('assistant', `❌ Could not find policy ID for ${token}`, true);
                return;
            }

            // Get enhanced holder data from our new endpoint
            const holderResponse = await fetch(`${this.apiBaseUrl}/analyze/${tickerData.token.policyId}/holders`);

            if (!holderResponse.ok) {
                this.addMessage('assistant', `❌ API Error: ${holderResponse.status}`, true);
                return;
            }

            const holderData = await holderResponse.json();

            if (holderData.holders && holderData.holders.length > 0) {
                this.createBubbleMapVisualization(token, holderData);
            } else {
                this.addMessage('assistant', `❌ Could not load holder data for ${token}`, true);
            }
        } catch (error) {
            this.addMessage('assistant', `❌ Error loading bubble map: ${error.message}`, true);
        }
    }

    createBubbleMapVisualization(token, holderData) {
        // Create bubble map modal
        const modal = document.createElement('div');
        modal.className = 'bubble-map-modal';
        modal.innerHTML = `
            <div class="bubble-map-container">
                <div class="bubble-map-header">
                    <div class="bubble-map-title">
                        <span class="bubble-icon">🫧</span>
                        <span>Bubble Map</span>
                        <span class="edit-icon">✏️</span>
                    </div>
                    <button class="close-button" onclick="this.closest('.bubble-map-modal').remove()">✕</button>
                </div>
                <div class="bubble-map-controls">
                    <div class="time-selector">
                        <span class="calendar-icon">📅</span>
                        <span>1m ago</span>
                        <span class="dropdown-arrow">▼</span>
                    </div>
                    <div class="cluster-button">
                        <span class="cluster-icon">🔗</span>
                    </div>
                </div>
                <div class="bubble-map-canvas" id="bubbleCanvas-${token}">
                    <svg width="100%" height="400" viewBox="0 0 800 400">
                        <!-- Bubbles will be generated here -->
                    </svg>
                </div>
                <div class="bubble-map-footer">
                    <span class="insightx-logo">iNSIGHTX</span>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .bubble-map-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }

            .bubble-map-container {
                background: #1a1a2e;
                border-radius: 12px;
                width: 90%;
                max-width: 900px;
                height: 80%;
                max-height: 600px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid #333;
            }

            .bubble-map-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #16213e;
                border-bottom: 1px solid #333;
            }

            .bubble-map-title {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #00ff88;
                font-weight: 600;
                font-size: 16px;
            }

            .bubble-icon {
                font-size: 18px;
            }

            .edit-icon {
                color: #666;
                font-size: 14px;
            }

            .close-button {
                background: none;
                border: none;
                color: #999;
                font-size: 20px;
                cursor: pointer;
                padding: 5px;
                border-radius: 4px;
            }

            .close-button:hover {
                background: #333;
                color: white;
            }

            .bubble-map-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 20px;
                background: #1a1a2e;
                border-bottom: 1px solid #333;
            }

            .time-selector {
                display: flex;
                align-items: center;
                gap: 8px;
                background: #2a2a4e;
                padding: 8px 12px;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }

            .cluster-button {
                background: #2a2a4e;
                padding: 8px 12px;
                border-radius: 8px;
                cursor: pointer;
            }

            .bubble-map-canvas {
                flex: 1;
                background: #16213e;
                position: relative;
                overflow: hidden;
            }

            .bubble-map-footer {
                padding: 10px 20px;
                background: #16213e;
                border-top: 1px solid #333;
                text-align: left;
            }

            .insightx-logo {
                color: #666;
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 1px;
            }

            .bubble {
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .bubble:hover {
                stroke-width: 3;
                filter: brightness(1.2);
            }

            .bubble-tooltip {
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                pointer-events: none;
                z-index: 1001;
                border: 1px solid #333;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // Generate bubbles
        this.generateBubbles(token, holderData);
    }

    generateBubbles(token, holderData) {
        const svg = document.querySelector(`#bubbleCanvas-${token} svg`);
        const width = 800;
        const height = 400;

        const holders = holderData.holders;
        const clusters = holderData.clusters;

        // Group holders by risk category for positioning
        const holdersByCategory = {
            safe: holders.filter(h => h.riskCategory === 'safe'),
            moderate_risk: holders.filter(h => h.riskCategory === 'moderate_risk'),
            high_risk: holders.filter(h => h.riskCategory === 'high_risk')
        };

        // Position clusters across the canvas
        const clusterPositions = [
            { x: width * 0.25, y: height * 0.5, category: 'safe', color: '#00ff88' },
            { x: width * 0.5, y: height * 0.3, category: 'moderate_risk', color: '#ffaa00' },
            { x: width * 0.75, y: height * 0.6, category: 'high_risk', color: '#ff4444' }
        ];

        clusterPositions.forEach((clusterPos) => {
            const categoryHolders = holdersByCategory[clusterPos.category] || [];

            categoryHolders.forEach((holder, holderIndex) => {
                // Use pre-calculated bubble size from API
                const radius = holder.bubbleSize || 20;

                // Position bubbles in a circular pattern around cluster center
                const angle = (holderIndex / categoryHolders.length) * 2 * Math.PI;
                const clusterRadius = Math.min(80 + (categoryHolders.length * 3), 120);

                const x = clusterPos.x + Math.cos(angle) * clusterRadius;
                const y = clusterPos.y + Math.sin(angle) * clusterRadius;

                // Create bubble
                const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                bubble.setAttribute('cx', Math.max(radius, Math.min(width - radius, x)));
                bubble.setAttribute('cy', Math.max(radius, Math.min(height - radius, y)));
                bubble.setAttribute('r', radius);
                bubble.setAttribute('fill', holder.riskColor);
                bubble.setAttribute('stroke', this.darkenColor(holder.riskColor));
                bubble.setAttribute('stroke-width', holder.isInfrastructure ? '3' : '2');
                bubble.setAttribute('opacity', holder.opacity || 0.8);
                bubble.className = 'bubble';

                // Add special styling for infrastructure
                if (holder.isInfrastructure) {
                    bubble.setAttribute('stroke-dasharray', '5,5');
                }

                // Add hover effects
                bubble.addEventListener('mouseenter', (e) => {
                    this.showBubbleTooltip(e, holder);
                });

                bubble.addEventListener('mouseleave', () => {
                    this.hideBubbleTooltip();
                });

                svg.appendChild(bubble);
            });
        });

        // Add cluster labels
        clusterPositions.forEach((clusterPos) => {
            const categoryHolders = holdersByCategory[clusterPos.category] || [];
            if (categoryHolders.length > 0) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', clusterPos.x);
                label.setAttribute('y', clusterPos.y - 150);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('fill', clusterPos.color);
                label.setAttribute('font-size', '14');
                label.setAttribute('font-weight', 'bold');
                label.textContent = `${clusterPos.category.replace('_', ' ').toUpperCase()} (${categoryHolders.length})`;
                svg.appendChild(label);
            }
        });

        // Add animation
        setTimeout(() => {
            const bubbles = svg.querySelectorAll('.bubble');
            bubbles.forEach((bubble, index) => {
                setTimeout(() => {
                    bubble.style.opacity = bubble.getAttribute('opacity');
                    bubble.style.transform = 'scale(1)';
                }, index * 30);
            });
        }, 100);
    }

    createHolderClusters(holders) {
        // Group holders by risk level
        const clusters = [
            {
                name: 'Safe Holders',
                holders: holders.filter(h => (h.percentage || 0) < 5),
                color: '#00ff88',
                strokeColor: '#00cc66'
            },
            {
                name: 'Moderate Risk',
                holders: holders.filter(h => (h.percentage || 0) >= 5 && (h.percentage || 0) < 15),
                color: '#ffaa00',
                strokeColor: '#cc8800'
            },
            {
                name: 'High Risk',
                holders: holders.filter(h => (h.percentage || 0) >= 15),
                color: '#ff4444',
                strokeColor: '#cc2222'
            }
        ].filter(cluster => cluster.holders.length > 0);

        return clusters;
    }

    darkenColor(color) {
        // Simple color darkening function
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    showBubbleTooltip(event, holder) {
        const tooltip = document.createElement('div');
        tooltip.className = 'bubble-tooltip';
        tooltip.innerHTML = `
            <div><strong>Rank:</strong> #${holder.rank}</div>
            <div><strong>Address:</strong> ${holder.address ? holder.address.substring(0, 20) + '...' : 'Unknown'}</div>
            <div><strong>Holdings:</strong> ${holder.percentage.toFixed(2)}%</div>
            <div><strong>Amount:</strong> ${holder.amount ? holder.amount.toLocaleString() : 'N/A'}</div>
            <div><strong>Risk:</strong> <span style="color: ${holder.riskColor}">${holder.riskCategory.replace('_', ' ')}</span></div>
            ${holder.isInfrastructure ? '<div><strong>Type:</strong> Infrastructure</div>' : ''}
        `;

        tooltip.style.left = event.pageX + 10 + 'px';
        tooltip.style.top = event.pageY - 10 + 'px';

        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;
    }

    hideBubbleTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.misterApp = new MisterApp();
});

// Utility functions for visualizations
function createHolderChart(holders) {
    // Implementation for holder distribution chart
    console.log('Creating holder chart:', holders);
}

function createClusterVisualization(clusters) {
    // Implementation for cluster visualization
    console.log('Creating cluster visualization:', clusters);
}

function createNetworkGraph(networkData) {
    // Implementation for network graph
    console.log('Creating network graph:', networkData);
}
