FROM node:22-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory
RUN mkdir -p /workspace /root/.claude/skills

WORKDIR /workspace

# Default: non-interactive mode
ENTRYPOINT ["claude", "--print"]
