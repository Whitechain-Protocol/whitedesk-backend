import re
import sys

def clean_file(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Match each <string name="...">...</string>
    pattern = re.compile(r'\s*<string name="key_v1-whitedesk_local_msgs_[^"]*">.*?</string>', re.DOTALL)
    cleaned = pattern.sub('', content)

    # Also clean any bloated whitedesk_local_tickets if over 50KB
    def clean_tickets(match):
        val = match.group(0)
        if len(val) > 20000:
            return ''
        return val
    cleaned = re.sub(r'\s*<string name="key_v1-whitedesk_local_tickets">.*?</string>', clean_tickets, cleaned, flags=re.DOTALL)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)

    print(f"Cleaned {input_path} ({len(content)} bytes) -> {output_path} ({len(cleaned)} bytes)")

if __name__ == '__main__':
    clean_file(sys.argv[1], sys.argv[2])
