package ai.keanu.android.ui

import androidx.compose.runtime.Composable
import ai.keanu.android.MainViewModel
import ai.keanu.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
