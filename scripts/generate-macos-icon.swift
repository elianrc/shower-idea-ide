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

let pipe = NSBezierPath()
pipe.lineWidth = 54
pipe.lineCapStyle = .round
pipe.lineJoinStyle = .round
pipe.move(to: NSPoint(x: 292, y: 718))
pipe.curve(
  to: NSPoint(x: 534, y: 720),
  controlPoint1: NSPoint(x: 334, y: 824),
  controlPoint2: NSPoint(x: 492, y: 824)
)
pipe.stroke()

let head = NSBezierPath()
head.lineWidth = 54
head.lineCapStyle = .round
head.move(to: NSPoint(x: 506, y: 724))
head.line(to: NSPoint(x: 690, y: 606))
head.stroke()

let waterLines: [(NSPoint, NSPoint)] = [
  (NSPoint(x: 468, y: 544), NSPoint(x: 382, y: 410)),
  (NSPoint(x: 558, y: 492), NSPoint(x: 472, y: 358)),
  (NSPoint(x: 648, y: 440), NSPoint(x: 562, y: 306)),
]

for (start, end) in waterLines {
  let line = NSBezierPath()
  line.lineWidth = 38
  line.lineCapStyle = .round
  line.move(to: start)
  line.line(to: end)
  line.stroke()
}

let sparkle = NSBezierPath()
sparkle.lineWidth = 30
sparkle.lineCapStyle = .round
sparkle.move(to: NSPoint(x: 732, y: 792))
sparkle.line(to: NSPoint(x: 732, y: 684))
sparkle.move(to: NSPoint(x: 678, y: 738))
sparkle.line(to: NSPoint(x: 786, y: 738))
sparkle.stroke()

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
