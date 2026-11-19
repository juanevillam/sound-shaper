import AVFoundation
import ExpoModulesCore
import UIKit

public class AudioSessionModule: Module {
  private static func findFormScrollView(in view: UIView) -> UIScrollView? {
    if let sv = view as? UIScrollView,
       sv.bounds.height > 0,
       sv.contentSize.height > sv.bounds.height + 4 {
      return sv
    }
    for subview in view.subviews {
      if let found = findFormScrollView(in: subview) {
        return found
      }
    }
    return nil
  }

  private static func hideNativeSeparators(in view: UIView, rootCell: UIView) {
    for sub in view.subviews {
      let typeName = String(describing: type(of: sub))
      let frameInCell = sub.convert(sub.bounds, to: rootCell)
      if typeName.contains("Separator") ||
         (sub.bounds.height > 0 && sub.bounds.height <= 1.5 && frameInCell.maxY >= rootCell.bounds.height - 3) {
        sub.isHidden = true
        sub.alpha = 0
      } else {
        hideNativeSeparators(in: sub, rootCell: rootCell)
      }
    }
  }

  private static func applyFullBleedSeparator(to cell: UICollectionViewCell) {
    hideNativeSeparators(in: cell, rootCell: cell)
  }

  private static func tuneScopeCells(in cv: UICollectionView) {
    // Sections 1 (Equalizer), 4 (Echo), and 5 (Next Room) have their studio
    // parameter scope at item 0.
    for section in [1, 4, 5] where section < cv.numberOfSections {
      guard cv.numberOfItems(inSection: section) > 0 else { continue }
      let indexPath = IndexPath(item: 0, section: section)
      if let cell = cv.cellForItem(at: indexPath) {
        applyFullBleedSeparator(to: cell)
      }
    }
  }

  public func definition() -> ModuleDefinition {
    Name("AudioSession")

    // True while another app's audio is playing. Read before this app takes
    // the non-mixing playback session, which would stop that audio for good.
    Function("isOtherAudioPlaying") { () -> Bool in
      AVAudioSession.sharedInstance().isOtherAudioPlaying
    }

    // Keep a directory (and so everything in it) out of iCloud and Finder
    // backups. For RE-DOWNLOADABLE content kept in Documents, which Apple's
    // data-storage guidance asks to be excluded. Takes a `file://` URI or a
    // plain path; throws if the attribute could not be set.
    Function("excludeFromBackup") { (path: String) throws in
      var url = path.hasPrefix("file://")
        ? (URL(string: path) ?? URL(fileURLWithPath: path))
        : URL(fileURLWithPath: path)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }

    // Smoothly scroll the open SwiftUI Form sheet so `section` is visible
    // while DJ Juan moves its controls. Skips if the person's finger is on
    // the scroll view.
    Function("scrollSheetSection") { (section: Int) in
      DispatchQueue.main.async {
        guard
          let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
          let window = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first,
          let root = window.rootViewController
        else { return }

        var scrollView: UIScrollView?
        var current = root.presentedViewController
        while let vc = current {
          if let found = Self.findFormScrollView(in: vc.view) {
            scrollView = found
          }
          current = vc.presentedViewController
        }
        guard let sv = scrollView, !sv.isDragging, !sv.isTracking else { return }

        let inset = sv.adjustedContentInset
        let minOffset = -inset.top
        let maxOffset = max(
          minOffset,
          sv.contentSize.height - sv.bounds.height + inset.bottom
        )
        guard maxOffset > minOffset else { return }

        let targetY: CGFloat
        if section <= 1 {
          targetY = minOffset
        } else if
          let cv = sv as? UICollectionView,
          section < cv.numberOfSections,
          cv.numberOfItems(inSection: section) > 0,
          let attrs = cv.layoutAttributesForItem(at: IndexPath(item: 0, section: section))
        {
          let centered = attrs.frame.midY - (sv.bounds.height * 0.45)
          targetY = min(max(centered, minOffset), maxOffset)
        } else if section >= 4 {
          targetY = maxOffset
        } else {
          let ratio = CGFloat(section) / 5.0
          targetY = minOffset + (maxOffset - minOffset) * ratio
        }

        if abs(sv.contentOffset.y - targetY) > 2 {
          sv.setContentOffset(CGPoint(x: sv.contentOffset.x, y: targetY), animated: true)
          if let cv = sv as? UICollectionView {
            Self.tuneScopeCells(in: cv)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
              Self.tuneScopeCells(in: cv)
            }
          }
        } else if let cv = sv as? UICollectionView {
          Self.tuneScopeCells(in: cv)
        }
      }
    }

    Function("prepareShapeScopeCells") { () in
      DispatchQueue.main.async {
        guard
          let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
          let window = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first,
          let root = window.rootViewController
        else { return }

        var scrollView: UIScrollView?
        var current = root.presentedViewController
        while let vc = current {
          if let found = Self.findFormScrollView(in: vc.view) {
            scrollView = found
          }
          current = vc.presentedViewController
        }
        if let cv = scrollView as? UICollectionView {
          Self.tuneScopeCells(in: cv)
        }
      }
    }
  }
}
