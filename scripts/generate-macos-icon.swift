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

let bookOutline = NSBezierPath()
bookOutline.lineWidth = 38
bookOutline.lineCapStyle = .butt
bookOutline.lineJoinStyle = .miter
bookOutline.move(to: NSPoint(x: 512, y: 778))
bookOutline.line(to: NSPoint(x: 300, y: 618))
bookOutline.line(to: NSPoint(x: 300, y: 246))
bookOutline.line(to: NSPoint(x: 512, y: 374))
bookOutline.line(to: NSPoint(x: 724, y: 246))
bookOutline.line(to: NSPoint(x: 724, y: 618))
bookOutline.close()
bookOutline.stroke()

let spine = NSBezierPath()
spine.lineWidth = 38
spine.lineCapStyle = .butt
spine.move(to: NSPoint(x: 512, y: 778))
spine.line(to: NSPoint(x: 512, y: 374))
spine.stroke()

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
