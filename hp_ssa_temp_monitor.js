#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// Configuration
const RAID_SLOTS = [2, 3];
const PUSHGATEWAY_BASE_URL = process.env.PUSHGATEWAY_BASE_URL;
const PUSHGATEWAY_METRIC_NAME = 'hp_ssa_disk_temp_celsius';
const PUSHGATEWAY_URL = `${PUSHGATEWAY_BASE_URL}/metrics/job/${PUSHGATEWAY_METRIC_NAME}/instance/${os.hostname()}`;
const DEBUG_MODE = process.argv.includes('--debug');
const LOG_FILE = '/var/log/hp_ssa_temp_monitor.log';

const getLogTimestamp = () => new Date().toISOString();

const logError = message => {
    const timestampedMessage = `[${getLogTimestamp()}] ${message}\n`;
    try {
        fs.appendFileSync(LOG_FILE, timestampedMessage, 'utf8');
    } catch (err) {
        console.error(`Failed to write to log file: ${LOG_FILE}`);
        console.error(err.message);
    }
};

const runCommand = command => {
    try {
        const output = execSync(command, { encoding: 'utf8' });
        return output;
    } catch (error) {
        logError(`Error executing command: ${command}`);
        logError(error.stdout || error.message);
        process.exit(1);
    }
};

const parseSsacliOutput = (output, slot) => {
    const lines = output.split('\n');
    const disks = [];
    let currentArray = null;
    let driveInfo = null;

    for (let line of lines) {
        line = line.trim();

        // Detect array name
        const arrayMatch = line.match(/^Array\s+(\S+)/i);
        if (arrayMatch) {
            currentArray = `slot${slot}_${arrayMatch[1].trim()}`;
            continue;
        }

        // Detect physical drive information
        const pdMatch = line.match(/^physicaldrive\s+(\S+)/i);
        if (pdMatch) {
            if (driveInfo) {
                disks.push(driveInfo);
            }

            driveInfo = { array: currentArray || `slot${slot}_unknown`, slot: pdMatch[1] };
            continue;
        }

        // Extract additional information if driveInfo is being processed
        if (driveInfo) {
            if (line.startsWith('Port:')) {
                driveInfo.port = line.split(':')[1].trim();
            } else if (line.startsWith('Box:')) {
                driveInfo.box = line.split(':')[1].trim();
            } else if (line.startsWith('Bay:')) {
                driveInfo.bay = line.split(':')[1].trim();
            } else if (line.startsWith('Status:')) {
                driveInfo.status = line.split(':')[1].trim();
            } else if (line.startsWith('Interface Type:')) {
                driveInfo.interfaceType = line.split(':')[1].trim();
            } else if (line.startsWith('Size:')) {
                driveInfo.size = line.split(':')[1].trim();
            } else if (line.startsWith('Current Temperature (C):')) {
                driveInfo.temperature = parseInt(line.split(':')[1].trim(), 10);
            }
        }
    }

    // Add the last driveInfo if it exists
    if (driveInfo) {
        disks.push(driveInfo);
    }

    return disks;
};

const collectDiskInfo = () => {
    let allDisks = [];

    for (const slot of RAID_SLOTS) {
        const command = `ssacli controller slot=${slot} physicaldrive all show detail`;
        const output = runCommand(command);
        const disks = parseSsacliOutput(output, slot);
        allDisks = allDisks.concat(disks);
    }

    return allDisks;
};

const formatMetrics = disks => {
    let metrics = `# HELP ${PUSHGATEWAY_METRIC_NAME} Temperature information about physical disks\n`;
    metrics += `# TYPE ${PUSHGATEWAY_METRIC_NAME} gauge\n`;

    for (const disk of disks) {
        const arrayLabel = disk.array.replace(/"/g, '\\"');
        const slotLabel = disk.slot.replace(/"/g, '\\"');
        const portLabel = (disk.port || 'unknown').replace(/"/g, '\\"');
        const boxLabel = (disk.box || 'unknown').replace(/"/g, '\\"');
        const bayLabel = (disk.bay || 'unknown').replace(/"/g, '\\"');
        const statusLabel = (disk.status || 'unknown').replace(/"/g, '\\"');
        const interfaceTypeLabel = (disk.interfaceType || 'unknown').replace(/"/g, '\\"');
        const sizeLabel = (disk.size || 'unknown').replace(/"/g, '\\"');

        metrics += `${PUSHGATEWAY_METRIC_NAME}{array="${arrayLabel}",slot="${slotLabel}",port="${portLabel}",box="${boxLabel}",bay="${bayLabel}",status="${statusLabel}",interface_type="${interfaceTypeLabel}",size="${sizeLabel}"} ${disk.temperature || 0}\n`;
    }

    return metrics;
};

const submitMetrics = metrics => {
    const curlCommand = `curl -s --data-binary @- ${PUSHGATEWAY_URL}`;
    try {
        execSync(curlCommand, { input: metrics, encoding: 'utf8' });
    } catch (error) {
        logError('Error submitting metrics to Pushgateway.');
        logError(error.stdout || error.message);
        process.exit(1);
    }
};

const main = () => {
    if (!PUSHGATEWAY_BASE_URL) {
        logError('Environment variable PUSHGATEWAY_BASE_URL is not set.');
        process.exit(1);
    }

    const disks = collectDiskInfo();
    const metrics = formatMetrics(disks);

    if (DEBUG_MODE) {
        console.log('Debug Mode: Payload to be submitted:');
        console.log(metrics);
    } else {
        submitMetrics(metrics);
    }
};

main();
