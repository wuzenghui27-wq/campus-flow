import Foundation
import Vision
import ImageIO

// Vision runs entirely on this Mac; image data is never sent to a server.
do {
    guard CommandLine.arguments.count == 2,
          let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "ResumeOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取扫描页"])
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    let supported = try request.supportedRecognitionLanguages()
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"].filter { supported.contains($0) }
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let words: [[String: Any]] = (request.results ?? []).compactMap { observation in
        guard let text = observation.topCandidates(1).first?.string else { return nil }
        let box = observation.boundingBox
        return ["text": text, "x": box.minX * Double(image.width),
                "y": (1 - box.maxY) * Double(image.height),
                "width": box.width * Double(image.width), "height": box.height * Double(image.height)]
    }
    let data = try JSONSerialization.data(withJSONObject: ["words": words, "width": image.width])
    FileHandle.standardOutput.write(data)
} catch {
    FileHandle.standardError.write(Data(error.localizedDescription.utf8))
    exit(1)
}
