# examples/fastlane-lane.rb
#
# Copy this lane into your project's fastlane/Fastfile to run
# ios-app-review-plugin as part of your Fastlane workflow.
#
# Prerequisites:
#   - Node.js >= 18
#   - npm install -g ios-app-review-plugin
#
# Usage:
#   fastlane ios_review
#   fastlane ios_review project_path:./MyApp.xcodeproj analyzers:info-plist,privacy

platform :ios do

  desc "Run iOS App Review to check for App Store rejection issues"
  lane :ios_review do |options|
    project_path = options[:project_path] || "."
    format = options[:format] || "json"
    output_file = options[:output] || "review-report.json"
    analyzers = options[:analyzers] || nil
    config_path = options[:config] || nil

    UI.header("iOS App Review Scan")

    # Ensure the tool is installed
    unless system("which ios-app-review > /dev/null 2>&1")
      UI.message("Installing ios-app-review-plugin...")
      sh("npm install -g ios-app-review-plugin")
    end

    # Build command
    cmd = "ios-app-review scan #{project_path.shellescape}"
    cmd += " --format #{format}"
    cmd += " --output #{output_file.shellescape}"
    cmd += " --analyzers #{analyzers}" if analyzers
    cmd += " --config #{config_path.shellescape}" if config_path

    # Execute scan
    exit_code = nil
    begin
      sh(cmd)
      exit_code = 0
    rescue FastlaneCore::Interface::FastlaneShellError => e
      exit_code = e.message.match(/exit status (\d+)/)[1].to_i rescue 2
    end

    # Parse and report results
    if format == "json" && File.exist?(output_file)
      report = JSON.parse(File.read(output_file))
      summary = report["summary"]

      UI.message("Total Issues: #{summary['totalIssues']}")
      UI.message("Errors: #{summary['errors']}, Warnings: #{summary['warnings']}, Info: #{summary['info']}")

      unless summary["passed"]
        UI.user_error!(
          "iOS App Review found #{summary['errors']} error(s). " \
          "Fix issues before submitting to the App Store."
        )
      end

      UI.success("iOS App Review: All checks passed!")
    elsif exit_code != 0
      UI.user_error!("iOS App Review scan failed (exit code #{exit_code}).")
    else
      UI.success("iOS App Review scan completed.")
    end
  end

end
