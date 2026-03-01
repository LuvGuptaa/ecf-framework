/**
 * Converts array-based structured data to TSV strings
 */
export function convertToTsv(headers: string[], rows: (string | number)[][]): string {
    const headerRow = headers.join('\t')
    const dataRows = rows.map((row) => row.join('\t')).join('\n')
    return `${headerRow}\n${dataRows}`
}

/**
 * Downloads a file locally
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/tab-separated-values') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Exports JS Psych CSV/JSON string to local download
 */
export function exportBehavioralData(participantId: string, taskName: string, jsPsychDataCsv: string) {
    const filename = `sub-${participantId}_task-${taskName}_beh.tsv`
    // Simple csv to tsv (rudimentary, assumes no escaping needed for tabs)
    const tsv = jsPsychDataCsv.replace(/,/g, '\t')
    downloadFile(filename, tsv)
}


