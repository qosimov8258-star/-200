package uz.reelstanlov.reels_tanlov

import android.os.Build
import android.os.Bundle
import android.view.View
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Tashqi klaviatura ulanganda Android butun ekran atrofida yashil
        // fokus ramkasini chizadi. Flutter fokusni o'zi ko'rsatadi.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            findViewById<View>(FLUTTER_VIEW_ID)?.defaultFocusHighlightEnabled = false
        }
    }
}
