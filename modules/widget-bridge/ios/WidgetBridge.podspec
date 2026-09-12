Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '0.0.0'
  s.summary        = 'Publishes an app snapshot into its shared App Group container.'
  s.description    = 'Writes an app-defined snapshot and its cached media into the shared App Group container an iOS widget reads, then asks WidgetKit to reload.'
  s.author         = 'juanevillam'
  s.homepage       = 'https://juanevillam.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
