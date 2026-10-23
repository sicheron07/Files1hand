/* =========================================
   FILES1HAND BY SICHERON
   JavaScript functionality
   ========================================= */

"use strict";


/* ---------- CONFIGURATION ---------- */

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const $ = (id) => document.getElementById(id);

let downloadUrls = [];
let mergedFiles = [];


/* ---------- GENERAL HELPERS ---------- */

function setStatus(id, message, type = "info") {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.dataset.status = type;
}

function setBusy(buttonId, busy, busyText = "Processing...") {
    const button = $(buttonId);
    if (!button) return;

    if (busy) {
        button.dataset.originalText = button.textContent;
        button.textContent = busyText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

function hideDownload(id) {
    const link = $(id);
    if (!link) return;

    link.hidden = true;
    link.removeAttribute("href");
}

function showDownload(id, blob, filename) {
    const link = $(id);
    if (!link) return;

    hideDownload(id);

    const url = URL.createObjectURL(blob);
    downloadUrls.push(url);

    link.href = url;
    link.download = filename;
    link.hidden = false;
}

function cleanFilename(filename) {
    return filename.replace(/\.[^/.]+$/, "");
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "";

    if (bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }

    return `${size.toFixed(2)} ${units[unit]}`;
}

function validatePdf(file) {
    return Boolean(
        file &&
        (file.type === "application/pdf" ||
         file.name.toLowerCase().endsWith(".pdf"))
    );
}

function requireLibrary(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function ensureFile(file, message) {
    if (!file) throw new Error(message);
}

function safeError(error) {
    console.error(error);

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "An unexpected error occurred. Please try again.";
}


/* ---------- SAME-PAGE SCROLLING ---------- */

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
        const target = $(button.dataset.scrollTarget);

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});


/* ---------- CURRENT YEAR ---------- */

if ($("currentYear")) {
    $("currentYear").textContent = new Date().getFullYear();
}


/* ---------- FILE LIST FOR MERGE PDF ---------- */

function renderMergeFileList() {
    const container = $("mergeFileList");
    if (!container) return;

    container.replaceChildren();

    mergedFiles.forEach((file, index) => {
        const row = document.createElement("div");
        row.className = "merge-file-item";

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent =
            `${index + 1}. ${file.name} (${formatBytes(file.size)})`;

        row.appendChild(name);

        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.gap = "6px";

        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "↑";
        up.setAttribute("aria-label", `Move ${file.name} up`);
        up.disabled = index === 0;

        up.addEventListener("click", () => {
            if (index === 0) return;

            [mergedFiles[index - 1], mergedFiles[index]] =
                [mergedFiles[index], mergedFiles[index - 1]];

            renderMergeFileList();
        });

        const down = document.createElement("button");
        down.type = "button";
        down.textContent = "↓";
        down.setAttribute("aria-label", `Move ${file.name} down`);
        down.disabled = index === mergedFiles.length - 1;

        down.addEventListener("click", () => {
            if (index >= mergedFiles.length - 1) return;

            [mergedFiles[index], mergedFiles[index + 1]] =
                [mergedFiles[index + 1], mergedFiles[index]];

            renderMergeFileList();
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${file.name}`);

        remove.addEventListener("click", () => {
            mergedFiles.splice(index, 1);
            renderMergeFileList();
        });

        controls.append(up, down, remove);
        row.appendChild(controls);
        container.appendChild(row);
    });
}

if ($("mergeFiles")) {
    $("mergeFiles").addEventListener("change", (event) => {
        const selected = Array.from(event.target.files || []);
        const invalid = selected.filter((file) => !validatePdf(file));

        if (invalid.length) {
            setStatus(
                "mergeStatus",
                "Please select PDF files only.",
                "error"
            );
        } else {
            setStatus("mergeStatus", "");
        }

        mergedFiles = selected.filter(validatePdf);
        hideDownload("mergeDownload");
        renderMergeFileList();
    });
}


/* ---------- MERGE PDF ---------- */

if ($("mergeButton")) {
    $("mergeButton").addEventListener("click", async () => {
        hideDownload("mergeDownload");

        if (mergedFiles.length < 2) {
            setStatus(
                "mergeStatus",
                "Please select at least two PDF files.",
                "error"
            );
            return;
        }

        setBusy("mergeButton", true, "Merging PDFs...");

        try {
            requireLibrary(
                window.PDFLib && window.PDFLib.PDFDocument,
                "The PDF library could not load. Check your internet connection and refresh the page."
            );

            const output = await PDFLib.PDFDocument.create();

            for (const file of mergedFiles) {
                const bytes = await file.arrayBuffer();
                const source = await PDFLib.PDFDocument.load(bytes);

                const pages = await output.copyPages(
                    source,
                    source.getPageIndices()
                );

                pages.forEach((page) => output.addPage(page));
            }

            const mergedBytes = await output.save();

            const blob = new Blob([mergedBytes], {
                type: "application/pdf"
            });

            showDownload(
                "mergeDownload",
                blob,
                "Files1hand-Merged.pdf"
            );

            setStatus(
                "mergeStatus",
                `Successfully merged ${mergedFiles.length} PDF files. Your download is ready.`,
                "success"
            );
        } catch (error) {
            setStatus(
                "mergeStatus",
                `Could not merge PDFs: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("mergeButton", false);
        }
    });
}


/* ---------- PDF COMPRESSION ---------- */

if ($("compressButton")) {
    $("compressButton").addEventListener("click", async () => {
        hideDownload("compressDownload");

        const file = $("compressFile").files[0];

        if (!file || !validatePdf(file)) {
            setStatus(
                "compressStatus",
                "Please select a valid PDF file.",
                "error"
            );
            return;
        }

        setBusy("compressButton", true, "Processing PDF...");

        try {
            requireLibrary(
                window.PDFLib && window.PDFLib.PDFDocument,
                "The PDF library could not load. Check your internet connection and refresh the page."
            );

            setStatus(
                "compressStatus",
                "Optimising the PDF structure. This cannot guarantee a smaller file for every PDF.",
                "info"
            );

            const bytes = await file.arrayBuffer();

            const pdf = await PDFLib.PDFDocument.load(bytes);

            const level = $("compressionLevel").value;

            const outputBytes = await pdf.save({
                useObjectStreams: true,
                addDefaultPage: false,
                objectsPerTick: level === "maximum" ? 25 : 50
            });

            const blob = new Blob([outputBytes], {
                type: "application/pdf"
            });

            showDownload(
                "compressDownload",
                blob,
                `${cleanFilename(file.name)}-compressed.pdf`
            );

            const difference = file.size - blob.size;

            let resultMessage =
                `Original: ${formatBytes(file.size)}. ` +
                `Processed: ${formatBytes(blob.size)}. `;

            if (difference > 0) {
                resultMessage +=
                    `Size reduced by ${((difference / file.size) * 100).toFixed(1)}%.`;
            } else if (difference < 0) {
                resultMessage +=
                    "The processed file is larger. This method does not recompress embedded images.";
            } else {
                resultMessage +=
                    "The file size did not change.";
            }

            setStatus("compressStatus", resultMessage, "success");
        } catch (error) {
            setStatus(
                "compressStatus",
                `Could not process PDF: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("compressButton", false);
        }
    });
}


/* ---------- IMAGES TO PDF ---------- */

if ($("imagesToPdfButton")) {
    $("imagesToPdfButton").addEventListener("click", async () => {
        hideDownload("imagesToPdfDownload");

        const files = Array.from($("imagesToPdfFiles").files || []);

        if (!files.length) {
            setStatus(
                "imagesToPdfStatus",
                "Please select one or more images.",
                "error"
            );
            return;
        }

        setBusy("imagesToPdfButton", true, "Creating PDF...");

        try {
            requireLibrary(
                window.PDFLib && window.PDFLib.PDFDocument,
                "The PDF library could not load. Check your internet connection."
            );

            const pdf = await PDFLib.PDFDocument.create();

            for (const file of files) {
                const imageBytes = await file.arrayBuffer();
                const type = file.type.toLowerCase();

                let image;

                if (type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
                    image = await pdf.embedJpg(imageBytes);
                } else if (
                    type === "image/png" ||
                    /\.png$/i.test(file.name)
                ) {
                    image = await pdf.embedPng(imageBytes);
                } else {
                    image = await embedImageUsingCanvas(
                        pdf,
                        file,
                        "image/png"
                    );
                }

                const page = pdf.addPage([
                    image.width,
                    image.height
                ]);

                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height
                });
            }

            const bytes = await pdf.save();

            showDownload(
                "imagesToPdfDownload",
                new Blob([bytes], { type: "application/pdf" }),
                "Files1hand-Images.pdf"
            );

            setStatus(
                "imagesToPdfStatus",
                `Created a PDF containing ${files.length} image(s).`,
                "success"
            );
        } catch (error) {
            setStatus(
                "imagesToPdfStatus",
                `Could not create PDF: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("imagesToPdfButton", false);
        }
    });
}


/* ---------- IMAGE HELPERS ---------- */

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not read this image."));
        };

        image.src = url;
    });
}

async function embedImageUsingCanvas(pdf, file, outputType) {
    const image = await loadImageFromFile(file);

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not prepare the image.");
    }

    context.drawImage(image, 0, 0);

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error("Could not convert the image."));
        }, outputType);
    });

    const bytes = await blob.arrayBuffer();

    return outputType === "image/jpeg"
        ? pdf.embedJpg(bytes)
        : pdf.embedPng(bytes);
}


/* ---------- IMAGE FORMAT CONVERTER ---------- */

if ($("imageConvertButton")) {
    $("imageConvertButton").addEventListener("click", async () => {
        hideDownload("imageConvertDownload");

        const file = $("imageConvertFile").files[0];
        const format = $("imageConvertFormat").value;

        if (!file || !file.type.startsWith("image/")) {
            setStatus(
                "imageConvertStatus",
                "Please select a valid image file.",
                "error"
            );
            return;
        }

        setBusy("imageConvertButton", true, "Converting image...");

        try {
            const image = await loadImageFromFile(file);

            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Could not prepare the image.");
            }

            if (format === "image/jpeg") {
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
            }

            context.drawImage(image, 0, 0);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    (result) => {
                        if (result) resolve(result);
                        else reject(new Error("Image conversion failed."));
                    },
                    format,
                    0.92
                );
            });

            const extension = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            }[format];

            showDownload(
                "imageConvertDownload",
                blob,
                `${cleanFilename(file.name)}.${extension}`
            );

            setStatus(
                "imageConvertStatus",
                `Image converted successfully (${formatBytes(blob.size)}).`,
                "success"
            );
        } catch (error) {
            setStatus(
                "imageConvertStatus",
                `Could not convert image: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("imageConvertButton", false);
        }
    });
}


/* ---------- PDF TO JPG + ZIP ---------- */

if ($("pdfToImagesButton")) {
    $("pdfToImagesButton").addEventListener("click", async () => {
        hideDownload("pdfImagesZipDownload");

        $("pdfImagesDetails").hidden = true;
        $("pdfImagesDownloads").replaceChildren();

        const file = $("pdfToImagesFile").files[0];

        if (!file || !validatePdf(file)) {
            setStatus(
                "pdfToImagesStatus",
                "Please select a valid PDF file.",
                "error"
            );
            return;
        }

        setBusy("pdfToImagesButton", true, "Converting pages...");

        try {
            requireLibrary(
                window.pdfjsLib,
                "The PDF rendering library could not load. Check your internet connection."
            );

            requireLibrary(
                window.JSZip,
                "The ZIP library could not load. Check your internet connection."
            );

            const pdf = await pdfjsLib.getDocument({
                data: await file.arrayBuffer()
            }).promise;

            const zip = new JSZip();
            const downloads = $("pdfImagesDownloads");

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                setStatus(
                    "pdfToImagesStatus",
                    `Converting page ${pageNumber} of ${pdf.numPages}...`,
                    "info"
                );

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5 });

                const canvas = document.createElement("canvas");
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);

                const context = canvas.getContext("2d");

                if (!context) {
                    throw new Error("Could not create an image canvas.");
                }

                await page.render({
                    canvasContext: context,
                    viewport
                }).promise;

                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob(
                        (result) => {
                            if (result) resolve(result);
                            else reject(new Error("Could not export a PDF page."));
                        },
                        "image/jpeg",
                        0.92
                    );
                });

                const filename =
                    `${cleanFilename(file.name)}-page-${pageNumber}.jpg`;

                zip.file(filename, blob);

                const url = URL.createObjectURL(blob);
                downloadUrls.push(url);

                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                link.textContent = `Download page ${pageNumber}`;

                downloads.appendChild(link);

                canvas.width = 0;
                canvas.height = 0;
            }

            const zipBlob = await zip.generateAsync({
                type: "blob"
            });

            showDownload(
                "pdfImagesZipDownload",
                zipBlob,
                `${cleanFilename(file.name)}-images.zip`
            );

            $("pdfImagesDetails").hidden = false;

            setStatus(
                "pdfToImagesStatus",
                `Successfully converted ${pdf.numPages} page(s). Download all pages as a ZIP or download them individually.`,
                "success"
            );
        } catch (error) {
            setStatus(
                "pdfToImagesStatus",
                `Could not convert PDF: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("pdfToImagesButton", false);
        }
    });
}


/* ---------- WORD TO PDF ---------- */

if ($("wordToPdfButton")) {
    $("wordToPdfButton").addEventListener("click", async () => {
        hideDownload("wordToPdfDownload");

        const file = $("wordToPdfFile").files[0];

        if (!file || !/\.docx$/i.test(file.name)) {
            setStatus(
                "wordToPdfStatus",
                "Please select a .docx Word document.",
                "error"
            );
            return;
        }

        setBusy("wordToPdfButton", true, "Converting document...");

        try {
            requireLibrary(
                window.mammoth && window.jspdf && window.jspdf.jsPDF,
                "A required conversion library could not load. Check your internet connection."
            );

            setStatus(
                "wordToPdfStatus",
                "Extracting document text. Advanced Word formatting may not be preserved.",
                "info"
            );

            const arrayBuffer = await file.arrayBuffer();

            const result = await mammoth.extractRawText({
                arrayBuffer
            });

            const text = result.value || "";

            if (!text.trim()) {
                throw new Error("No readable text was found in the document.");
            }

            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
                unit: "mm",
                format: "a4"
            });

            const margin = 18;
            const pageWidth = 210;
            const pageHeight = 297;
            const maxWidth = pageWidth - margin * 2;
            const maxHeight = pageHeight - margin * 2;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);

            const lines = pdf.splitTextToSize(text, maxWidth);
            const lineHeight = 5;

            let y = margin;

            for (const line of lines) {
                if (y + lineHeight > maxHeight + margin) {
                    pdf.addPage();
                    y = margin;
                }

                pdf.text(line, margin, y);
                y += lineHeight;
            }

            const blob = pdf.output("blob");

            showDownload(
                "wordToPdfDownload",
                blob,
                `${cleanFilename(file.name)}.pdf`
            );

            setStatus(
                "wordToPdfStatus",
                "PDF created from extracted text. Original layout, images and advanced formatting are not preserved.",
                "success"
            );
        } catch (error) {
            setStatus(
                "wordToPdfStatus",
                `Could not convert Word file: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("wordToPdfButton", false);
        }
    });
}


/* ---------- PDF TO WORD ---------- */

if ($("pdfToWordButton")) {
    $("pdfToWordButton").addEventListener("click", async () => {
        hideDownload("pdfToWordDownload");

        const file = $("pdfToWordFile").files[0];

        if (!file || !validatePdf(file)) {
            setStatus(
                "pdfToWordStatus",
                "Please select a valid PDF file.",
                "error"
            );
            return;
        }

        setBusy("pdfToWordButton", true, "Extracting text...");

        try {
            requireLibrary(
                window.pdfjsLib && window.mammoth,
                "A required document library could not load. Check your internet connection."
            );

            const pdf = await pdfjsLib.getDocument({
                data: await file.arrayBuffer()
            }).promise;

            const pages = [];

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                setStatus(
                    "pdfToWordStatus",
                    `Extracting page ${pageNumber} of ${pdf.numPages}...`,
                    "info"
                );

                const page = await pdf.getPage(pageNumber);
                const content = await page.getTextContent();

                const text = content.items
                    .map((item) => item.str || "")
                    .join(" ");

                pages.push(text);
            }

            const fullText = pages.join("\n\n");

            if (!fullText.trim()) {
                throw new Error(
                    "No selectable text was found. Scanned PDFs require OCR."
                );
            }

            const escapedText = fullText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");

            const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p>
<w:r>
<w:t xml:space="preserve">${escapedText}</w:t>
</w:r>
</w:p>
<w:sectPr>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;

            const blob = createMinimalDocx(documentXml);

            showDownload(
                "pdfToWordDownload",
                blob,
                `${cleanFilename(file.name)}.docx`
            );

            setStatus(
                "pdfToWordStatus",
                "Word document created from extracted text. Original layout, images and tables may not be preserved.",
                "success"
            );
        } catch (error) {
            setStatus(
                "pdfToWordStatus",
                `Could not convert PDF: ${safeError(error)}`,
                "error"
            );
        } finally {
            setBusy("pdfToWordButton", false);
        }
    });
}


/* ---------- MINIMAL DOCX CREATION ---------- */

/*
   A DOCX file is a ZIP archive containing several XML files.
   This creates the minimal archive needed for a text-only document.
*/

function createMinimalDocx(documentXml) {
    const files = [
        {
            name: "[Content_Types].xml",
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
        },
        {
            name: "_rels/.rels",
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
        },
        {
            name: "word/document.xml",
            data: documentXml
        }
    ];

    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];

    let offset = 0;

    function crc32(bytes) {
        let crc = -1;

        for (const byte of bytes) {
            crc ^= byte;

            for (let bit = 0; bit < 8; bit++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
            }
        }

        return (crc ^ -1) >>> 0;
    }

    function u16(value) {
        return [value & 255, (value >>> 8) & 255];
    }

    function u32(value) {
        return [
            value & 255,
            (value >>> 8) & 255,
            (value >>> 16) & 255,
            (value >>> 24) & 255
        ];
    }

    function concatBytes(arrays) {
        const total = arrays.reduce((sum, array) => sum + array.length, 0);
        const result = new Uint8Array(total);

        let position = 0;

        for (const array of arrays) {
            result.set(array, position);
            position += array.length;
        }

        return result;
    }

    for (const file of files) {
        const nameBytes = encoder.encode(file.name);
        const dataBytes = encoder.encode(file.data);
        const crc = crc32(dataBytes);

        const localHeader = concatBytes([
            new Uint8Array(u32(0x04034b50)),
            new Uint8Array(u16(20)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u32(crc)),
            new Uint8Array(u32(dataBytes.length)),
            new Uint8Array(u32(dataBytes.length)),
            new Uint8Array(u16(nameBytes.length)),
            new Uint8Array(u16(0)),
            nameBytes
        ]);

        localParts.push(localHeader, dataBytes);

        const centralHeader = concatBytes([
            new Uint8Array(u32(0x02014b50)),
            new Uint8Array(u16(20)),
            new Uint8Array(u16(20)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u32(crc)),
            new Uint8Array(u32(dataBytes.length)),
            new Uint8Array(u32(dataBytes.length)),
            new Uint8Array(u16(nameBytes.length)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u16(0)),
            new Uint8Array(u32(0)),
            new Uint8Array(u32(offset)),
            nameBytes
        ]);

        centralParts.push(centralHeader);

        offset += localHeader.length + dataBytes.length;
    }

    const centralDirectory = concatBytes(centralParts);
    const localDirectory = concatBytes(localParts);

    const endRecord = concatBytes([
        new Uint8Array(u32(0x06054b50)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(0)),
        new Uint8Array(u16(files.length)),
        new Uint8Array(u16(files.length)),
        new Uint8Array(u32(centralDirectory.length)),
        new Uint8Array(u32(localDirectory.length)),
        new Uint8Array(u16(0))
    ]);

    return new Blob(
        [localDirectory, centralDirectory, endRecord],
        {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
    );
}


/* ---------- INITIALISE ---------- */

document.addEventListener("DOMContentLoaded", () => {
    renderMergeFileList();

    console.log("Files1hand by Sicheron is ready.");
});
