#!/usr/bin/env python3
"""
USER ONBOARDING - Import your AI history
========================================

SOURCES:
1. Claude Code CLI - history + memories (~/.claude/)
2. Claude.ai export - Settings → Export Data
3. ChatGPT export - Settings → Data Controls → Export

USAGE:
  ./keanu onboard              # Interactive
  ./keanu onboard --fresh      # Start clean
"""

import json
import re
import zipfile
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from dotenv import load_dotenv

# Load .env
for p in [Path(__file__).parent.parent.parent / ".env", Path.home() / ".env"]:
    if p.exists():
        load_dotenv(p)
        break

OUTPUT_DIR = Path(__file__).parent / "user-onboarding"
OUTPUT_DIR.mkdir(exist_ok=True)


# ============================================================
# CLAUDE CODE CLI - History + Memories
# ============================================================

def import_claude_code() -> dict:
    """Import Claude Code CLI history and memories."""
    print("\n" + "="*60)
    print("CLAUDE CODE CLI")
    print("="*60)

    results = {"conversations": [], "memories": [], "projects": []}
    claude_dir = Path.home() / ".claude"

    if not claude_dir.exists():
        print("Not found: ~/.claude")
        return results

    # History
    history_file = claude_dir / "history.jsonl"
    if history_file.exists():
        sessions = defaultdict(list)
        with open(history_file) as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    sessions[entry.get("sessionId", "unknown")].append(entry)
                except:
                    pass

        for sid, msgs in sessions.items():
            project = msgs[0].get("project", "") if msgs else ""
            results["conversations"].append({
                "source": "claude-code",
                "id": sid,
                "title": Path(project).name if project else "Session",
                "project": project,
                "messages": [{"role": "user", "content": m.get("display", "")} for m in msgs],
            })
        print(f"✓ History: {len(sessions)} sessions, {sum(len(m) for m in sessions.values())} messages")

    # Memories from each project
    projects_dir = claude_dir / "projects"
    if projects_dir.exists():
        for proj in projects_dir.iterdir():
            if not proj.is_dir():
                continue

            proj_data = {"name": proj.name, "memories": []}
            results["projects"].append(proj_data)

            # CLAUDE.md
            claude_md = proj / "CLAUDE.md"
            if claude_md.exists():
                content = claude_md.read_text()
                proj_data["claude_md"] = content
                results["memories"].append({
                    "source": "claude-code",
                    "project": proj.name,
                    "type": "CLAUDE.md",
                    "content": content,
                })

            # Memory folder
            memory_dir = proj / "memory"
            if memory_dir.exists():
                for mem_file in memory_dir.glob("*.md"):
                    content = mem_file.read_text()
                    proj_data["memories"].append(mem_file.name)
                    results["memories"].append({
                        "source": "claude-code",
                        "project": proj.name,
                        "type": mem_file.name,
                        "content": content,
                    })

        print(f"✓ Projects: {len(results['projects'])}")
        print(f"✓ Memories: {len(results['memories'])} files")

    return results


# ============================================================
# CLAUDE.AI EXPORT
# ============================================================

def import_claude_export(path: Path) -> list:
    """Import Claude.ai export file."""
    print(f"\nImporting: {path}")
    conversations = []

    if path.suffix == ".zip":
        with zipfile.ZipFile(path, 'r') as z:
            for name in z.namelist():
                if name.endswith(".json"):
                    with z.open(name) as f:
                        data = json.load(f)
                    conversations.extend(parse_claude_data(data))
    else:
        with open(path) as f:
            data = json.load(f)
        conversations.extend(parse_claude_data(data))

    print(f"✓ Loaded {len(conversations)} conversations")
    return conversations


def parse_claude_data(data) -> list:
    """Parse Claude.ai export format."""
    conversations = []

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict) and "conversations" in data:
        items = data["conversations"]
    else:
        items = [data]

    for conv in items:
        messages = []
        for msg in conv.get("chat_messages", []):
            role = "user" if msg.get("sender") == "human" else "assistant"
            content = msg.get("text", "")
            if not content and "content" in msg:
                c = msg["content"]
                content = " ".join(x.get("text", "") for x in c if isinstance(x, dict)) if isinstance(c, list) else str(c)
            if content:
                messages.append({"role": role, "content": content})

        conversations.append({
            "source": "claude-web",
            "id": conv.get("uuid", conv.get("id", "")),
            "title": conv.get("name", conv.get("title", "Untitled")),
            "messages": messages,
        })

    return conversations


# ============================================================
# CHATGPT EXPORT
# ============================================================

def import_chatgpt_export(path: Path) -> list:
    """Import ChatGPT export zip."""
    print(f"\nImporting: {path}")
    conversations = []

    with zipfile.ZipFile(path, 'r') as z:
        for name in z.namelist():
            if "conversations" in name and name.endswith(".json"):
                with z.open(name) as f:
                    data = json.load(f)

                for conv in data if isinstance(data, list) else [data]:
                    messages = []
                    for node in conv.get("mapping", {}).values():
                        msg = node.get("message")
                        if msg and msg.get("content"):
                            content = msg["content"]
                            text = ""
                            if isinstance(content, dict):
                                text = "\n".join(str(p) for p in content.get("parts", []) if p)
                            else:
                                text = str(content)
                            if text.strip():
                                messages.append({
                                    "role": msg.get("author", {}).get("role", "user"),
                                    "content": text,
                                })

                    conversations.append({
                        "source": "chatgpt",
                        "id": conv.get("id", ""),
                        "title": conv.get("title", "Untitled"),
                        "messages": messages,
                    })

    print(f"✓ Loaded {len(conversations)} conversations")
    return conversations


# ============================================================
# PROFILE GENERATION
# ============================================================

def generate_profile(conversations: list, memories: list) -> dict:
    """Generate user profile from conversations and memories."""
    print("\n" + "="*60)
    print("GENERATING PROFILE")
    print("="*60)

    try:
        import anthropic
        client = anthropic.Anthropic()
    except:
        print("(anthropic not installed, skipping profile)")
        return {}

    # Sample data
    user_messages = []
    topics = []

    for conv in conversations[:50]:
        if conv.get("title"):
            topics.append(conv["title"])
        for msg in conv.get("messages", [])[:3]:
            if msg.get("role") in ["user", "human"]:
                user_messages.append(msg.get("content", "")[:500])

    # Include memories
    memory_texts = [m.get("content", "")[:1000] for m in memories[:10]]

    if not user_messages and not topics and not memory_texts:
        print("No data to analyze")
        return {}

    print(f"Analyzing {len(user_messages)} messages, {len(topics)} topics, {len(memory_texts)} memories...")

    prompt = f"""Analyze this user's AI conversation history and memories to understand who they are.

CONVERSATION TITLES:
{chr(10).join(topics[:30])}

USER MESSAGES (sample):
{chr(10).join(user_messages[:20])}

MEMORIES/NOTES:
{chr(10).join(memory_texts[:5])}

Generate JSON profile:
{{"likely_profession": "...", "technical_level": "beginner/intermediate/advanced/expert", "interests": [...], "communication_style": "...", "common_needs": [...], "personality_traits": [...], "projects_mentioned": [...], "tools_used": [...], "summary": "2-3 sentences"}}

Output ONLY JSON."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            profile = json.loads(match.group())
            print("✓ Profile generated")
            return profile
    except Exception as e:
        print(f"Error: {e}")

    return {}


# ============================================================
# MAIN
# ============================================================

def save_all(conversations: list, memories: list, profile: dict):
    """Save everything."""
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")

    # Conversations
    if conversations:
        path = OUTPUT_DIR / f"conversations-{ts}.json"
        with open(path, "w") as f:
            json.dump(conversations, f, indent=2)
        print(f"\n✓ Saved {len(conversations)} conversations → {path.name}")

    # Memories
    if memories:
        path = OUTPUT_DIR / f"memories-{ts}.json"
        with open(path, "w") as f:
            json.dump(memories, f, indent=2)
        print(f"✓ Saved {len(memories)} memories → {path.name}")

    # Profile
    if profile:
        path = OUTPUT_DIR / "user-profile-latest.json"
        with open(path, "w") as f:
            json.dump(profile, f, indent=2)
        print(f"✓ Saved profile → {path.name}")


def fresh_start():
    """Start fresh."""
    profile = {
        "fresh_start": True,
        "created": datetime.now().isoformat(),
        "summary": "Fresh start - profile will be built through conversation."
    }
    path = OUTPUT_DIR / "user-profile-latest.json"
    with open(path, "w") as f:
        json.dump(profile, f, indent=2)
    print(f"✓ Fresh profile → {path}")


def main():
    parser = argparse.ArgumentParser(description="Import AI conversation history")
    parser.add_argument("--fresh", action="store_true", help="Start fresh")
    parser.add_argument("--claude", type=str, help="Claude.ai export path")
    parser.add_argument("--chatgpt", type=str, help="ChatGPT export path")
    args = parser.parse_args()

    print("="*60)
    print("KEANU ONBOARDING")
    print("="*60)

    if args.fresh:
        fresh_start()
        return

    all_conversations = []
    all_memories = []

    # Always import Claude Code CLI
    cli_data = import_claude_code()
    all_conversations.extend(cli_data["conversations"])
    all_memories.extend(cli_data["memories"])

    # Import loop
    while True:
        print("\n" + "-"*40)
        print("Import more? (or press Enter to finish)")
        print("  [1] Claude.ai export (.json or .zip)")
        print("  [2] ChatGPT export (.zip)")
        print("  [3] Done - generate profile")
        print()

        try:
            choice = input("Choice: ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if choice == "1":
            path = input("Path to Claude export: ").strip()
            if path and Path(path).exists():
                all_conversations.extend(import_claude_export(Path(path)))
            else:
                print("File not found")
        elif choice == "2":
            path = input("Path to ChatGPT zip: ").strip()
            if path and Path(path).exists():
                all_conversations.extend(import_chatgpt_export(Path(path)))
            else:
                print("File not found")
        elif choice == "3" or choice == "":
            break

    # Generate profile
    profile = {}
    if all_conversations or all_memories:
        profile = generate_profile(all_conversations, all_memories)

    # Save
    save_all(all_conversations, all_memories, profile)

    print("\n" + "="*60)
    print("DONE")
    print("="*60)


if __name__ == "__main__":
    main()
