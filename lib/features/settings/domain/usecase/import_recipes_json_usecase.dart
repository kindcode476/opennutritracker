import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:opennutritracker/core/domain/usecase/save_recipe_usecase.dart';
import 'package:opennutritracker/core/utils/json_recipe_importer.dart';

class ImportRecipesJsonResult {
  final int imported;
  final int skippedRecipes;
  final List<String> errorMessages;

  const ImportRecipesJsonResult({
    required this.imported,
    required this.skippedRecipes,
    required this.errorMessages,
  });
}

/// Picks a `.json` file from disk, validates the content via
/// [JsonRecipeImporter.parse], and persists each successfully-parsed
/// recipe via [SaveRecipeUseCase] — symmetric with
/// [ImportRecipesCsvUsecase] so the UI can treat both import paths
/// identically.
class ImportRecipesJsonUsecase {
  final SaveRecipeUseCase _saveRecipeUseCase;

  ImportRecipesJsonUsecase(this._saveRecipeUseCase);

  /// Returns null when the user cancelled the file picker.
  Future<ImportRecipesJsonResult?> importFromPickedFile() async {
    final picked = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: ['json'],
    );
    if (picked == null) {
      return null;
    }

    // Read through PlatformFile rather than dart:io. On the web a picked
    // file has no path — it is a blob the browser holds — so File(picked.path!)
    // threw before it could read a byte. This reads the same file on every
    // platform, and is what makes import work in the browser at all.
    final content = utf8.decode(await picked.readAsBytes());

    final parseResult = JsonRecipeImporter.parse(content);

    for (final recipe in parseResult.recipes) {
      // SaveRecipeUseCase recomputes nutrition on save, matching the CSV
      // and recipe-builder paths so values land identical regardless of
      // entry point.
      await _saveRecipeUseCase.save(recipe);
    }

    return ImportRecipesJsonResult(
      imported: parseResult.recipes.length,
      skippedRecipes: parseResult.errors.length,
      errorMessages: parseResult.errors,
    );
  }
}
