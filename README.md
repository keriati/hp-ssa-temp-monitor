# HP SSA Temperature Monitor

## Overview

This script is designed for HP Smart Array controllers managed using the `ssacli` command-line utility. It collects information about RAID disk temperatures and details, formats them as Prometheus-compatible metrics, and submits them to a Prometheus Pushgateway.

## Features

- Collects disk temperature and metadata (port, box, bay, status, interface type, size, etc.) for specified RAID controller slots.
- Formats the data into Prometheus exposition format for easy monitoring.
- Submits metrics to a Prometheus Pushgateway.
- Includes debug mode for troubleshooting.

## Prerequisites

- **HP Smart Array controllers** (e.g., P410, P420, and others supported by `ssacli`)
- `ssacli` installed and available in the system's PATH.
- Node.js environment to execute the script.
- A Prometheus Pushgateway instance.

## Installation

1. Clone this repository or copy the script to your preferred location.
2. Ensure `ssacli` is installed and configured to manage your RAID controllers.
3. Set up a Prometheus Pushgateway to receive the metrics.

## Configuration

### Environment Variables

- **`PUSHGATEWAY_BASE_URL`** (Required): The URL of your Prometheus Pushgateway. The script logs an error and exits if this variable is not set.

### Script Constants

- **`RAID_SLOTS`**: Array of RAID controller slot numbers to query. Update this to match your setup.
- **`LOG_FILE`**: Path to the log file where errors will be logged. Default is `/var/log/raid_disk_info.log`.

## Usage

### Basic Execution

Run the script using:

```bash
node hp_ssa_temp_monitor.js
```

### Debug Mode

To view the formatted metrics without submitting them to Pushgateway, use the `--debug` flag:

```bash
node hp_ssa_temp_monitor.js --debug
```

### Setting the Pushgateway URL

Ensure the `PUSHGATEWAY_BASE_URL` environment variable is set before running the script:

```bash
export PUSHGATEWAY_BASE_URL="http://your-pushgateway-url:9091"
```

### Error Logging

Errors are logged to the file specified by `LOG_FILE` with a UNIX-compatible timestamp.

## Metrics

Metrics are formatted in Prometheus exposition format and include the following labels:

- `array`: Array name or identifier.
- `slot`: Physical drive slot identifier.
- `port`: Port where the drive is connected.
- `box`: Box where the drive resides.
- `bay`: Bay within the box.
- `status`: Status of the drive.
- `interface_type`: Drive interface type (e.g., SATA, SAS).
- `size`: Drive size.

The metric `hp_ssa_disk_temp_celsius` represents the temperature of the disk in Celsius.

## Notes

- Ensure the script has sufficient permissions to execute `ssacli` commands and write to the log file.
- Use a process manager like `systemd` or `cron` for periodic execution.

## License

This script is open-source and provided as-is. Use at your own risk.

## Support

For issues or contributions, please submit a pull request or open an issue in the repository.