Pod::Spec.new do |s|
  s.name           = 'AudioSession'
  s.version        = '0.0.0'
  s.summary        = 'Reads whether another app is playing audio.'
  s.description    = 'Answers one question the audio library does not expose: is audio from another app playing right now.'
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
