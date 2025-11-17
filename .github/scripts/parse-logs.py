#!/usr/bin/env python3
"""Parse GitHub Actions logs and convert to JSON format."""

import argparse
import json
import re
import sys


def parse_logs(log_file):
    """Parse log file and return structured data."""
    jobs = []
    current_job = None
    current_group = None

    with open(log_file, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
        for line in f:
            line = line.rstrip('\n\r')
            if not line:
                continue

            # Split the line: job_name\tUNKNOWN STEP\tlog_content
            parts = line.split('\t', 2)
            if len(parts) < 3:
                continue

            job_name = parts[0]
            log_content = parts[2]

            # Strip timestamp prefix from log_content (format: YYYY-MM-DDTHH:MM:SS.NNNNNNNZ )
            log_content = re.sub(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+', '', log_content)

            # Start new job if needed
            if current_job is None or current_job['job_name'] != job_name:
                if current_job is not None:
                    # Close any open group
                    if current_group is not None:
                        current_job['groups'].append(current_group)
                        current_group = None
                    jobs.append(current_job)

                current_job = {
                    'job_name': job_name,
                    'outcome': 'success',
                    'groups': [],
                    'error_message': None
                }

            # Check for ##[group] marker
            group_match = re.match(r'##\[group\](.+)', log_content)
            if group_match:
                # Close previous group if open
                if current_group is not None:
                    current_job['groups'].append(current_group)

                current_group = {
                    'name': group_match.group(1),
                    'logs': []
                }
                continue

            # Check for ##[endgroup] marker
            if re.match(r'##\[endgroup\]', log_content):
                if current_group is not None:
                    current_job['groups'].append(current_group)
                    current_group = None
                continue

            # Check for ##[error] marker
            error_match = re.match(r'##\[error\](.+)', log_content)
            if error_match:
                current_job['error_message'] = error_match.group(1)
                current_job['outcome'] = 'failure'
                if current_group is not None:
                    current_group['logs'].append(log_content)
                continue

            # Add regular log line to current group
            if current_group is not None:
                current_group['logs'].append(log_content)

    # Close last job
    if current_job is not None:
        if current_group is not None:
            current_job['groups'].append(current_group)
        jobs.append(current_job)

    return jobs


def validate_job(job, expectations):
    """Validate a job against expectations."""
    errors = []

    # Check outcome
    if expectations.get('outcome') and job['outcome'] != expectations['outcome']:
        errors.append(f"Expected outcome '{expectations['outcome']}', got '{job['outcome']}'")

    # Check group exists
    if expectations.get('group_exists'):
        group_names = [g['name'] for g in job['groups']]
        for expected_group in expectations['group_exists']:
            if expected_group not in group_names:
                errors.append(f"Expected group '{expected_group}' not found. Available groups: {group_names}")

    # Check group contains text in last line
    if expectations.get('group_last_line_contains'):
        for group_name, expected_text in expectations['group_last_line_contains'].items():
            group = next((g for g in job['groups'] if g['name'] == group_name), None)
            if not group:
                errors.append(f"Group '{group_name}' not found for last line check")
            elif not group['logs']:
                errors.append(f"Group '{group_name}' has no logs")
            elif expected_text not in group['logs'][-1]:
                errors.append(f"Group '{group_name}' last line doesn't contain '{expected_text}': {group['logs'][-1]}")

    # Check error message contains text
    if expectations.get('error_contains'):
        if not job['error_message']:
            errors.append(f"Expected error message containing '{expectations['error_contains']}', but no error message found")
        elif expectations['error_contains'] not in job['error_message']:
            errors.append(f"Error message doesn't contain '{expectations['error_contains']}': {job['error_message']}")

    return errors


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Parse and validate GitHub Actions logs')
    parser.add_argument('log_file', help='Log file to parse')
    parser.add_argument('--job-index', type=int, default=0, help='Job index to validate (default: 0)')
    parser.add_argument('--expect-outcome', choices=['success', 'failure'], help='Expected job outcome')
    parser.add_argument('--expect-group', action='append', dest='expect_groups', help='Expected group name (can be specified multiple times)')
    parser.add_argument('--expect-group-last-line', action='append', dest='expect_group_last_lines',
                        help='Expected text in last line of group (format: group_name=text)')
    parser.add_argument('--expect-error-contains', help='Expected text in error message')
    parser.add_argument('--output-json', action='store_true', help='Output full JSON instead of validation')

    args = parser.parse_args()

    jobs = parse_logs(args.log_file)

    if args.output_json:
        print(json.dumps(jobs, indent=2))
        return

    if not jobs:
        print("Error: No jobs found in log file", file=sys.stderr)
        sys.exit(1)

    if args.job_index >= len(jobs):
        print(f"Error: Job index {args.job_index} out of range (found {len(jobs)} jobs)", file=sys.stderr)
        sys.exit(1)

    job = jobs[args.job_index]

    # Build expectations
    expectations = {}
    if args.expect_outcome:
        expectations['outcome'] = args.expect_outcome
    if args.expect_groups:
        expectations['group_exists'] = args.expect_groups
    if args.expect_group_last_lines:
        expectations['group_last_line_contains'] = {}
        for item in args.expect_group_last_lines:
            if '=' not in item:
                print(f"Error: --expect-group-last-line must be in format 'group_name=text'", file=sys.stderr)
                sys.exit(1)
            group_name, text = item.split('=', 1)
            expectations['group_last_line_contains'][group_name] = text
    if args.expect_error_contains:
        expectations['error_contains'] = args.expect_error_contains

    # Validate
    errors = validate_job(job, expectations)

    if errors:
        print(f"Validation failed for job '{job['job_name']}':", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        sys.exit(1)

    print(f"✓ Validation passed for job '{job['job_name']}'")


if __name__ == '__main__':
    main()
