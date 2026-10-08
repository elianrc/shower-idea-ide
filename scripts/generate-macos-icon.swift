import AppKit

let canvasSize = NSSize(width: 1024, height: 1024)
let image = NSImage(size: canvasSize)

image.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high

NSColor.clear.setFill()
NSRect(origin: .zero, size: canvasSize).fill()

let tile = NSBezierPath(
  roundedRect: NSRect(x: 64, y: 64, width: 896, height: 896),
  xRadius: 206,
  yRadius: 206
)
NSColor(calibratedWhite: 0.035, alpha: 1).setFill()
tile.fill()

NSColor.white.setStroke()

let leftPage = NSBezierPath()
leftPage.lineWidth = 38
leftPage.lineCapStyle = .round
leftPage.lineJoinStyle = .round
leftPage.move(to: NSPoint(x: 512, y: 680))
leftPage.line(to: NSPoint(x: 246, y: 735))
leftPage.line(to: NSPoint(x: 246, y: 300))
leftPage.curve(
  to: NSPoint(x: 512, y: 330),
  controlPoint1: NSPoint(x: 346, y: 278),
  controlPoint2: NSPoint(x: 442, y: 298)
)
leftPage.close()
leftPage.stroke()

let rightPage = NSBezierPath()
rightPage.lineWidth = 38
rightPage.lineCapStyle = .round
rightPage.lineJoinStyle = .round
rightPage.move(to: NSPoint(x: 512, y: 680))
rightPage.line(to: NSPoint(x: 778, y: 735))
rightPage.line(to: NSPoint(x: 778, y: 300))
rightPage.curve(
  to: NSPoint(x: 512, y: 330),
  controlPoint1: NSPoint(x: 678, y: 278),
  controlPoint2: NSPoint(x: 582, y: 298)
)
rightPage.close()
rightPage.stroke()

image.unlockFocus()

guard
  let tiff = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let png = bitmap.representation(using: .png, properties: [:])
else {
  fatalError("Could not render icon")
}

let outputPath = CommandLine.arguments.dropFirst().first ?? "build/icon.png"
try FileManager.default.createDirectory(
  at: URL(fileURLWithPath: outputPath).deletingLastPathComponent(),
  withIntermediateDirectories: true
)
try png.write(to: URL(fileURLWithPath: outputPath))
