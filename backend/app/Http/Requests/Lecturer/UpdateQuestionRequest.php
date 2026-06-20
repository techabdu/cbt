<?php

namespace App\Http\Requests\Lecturer;

/**
 * Updating a question replaces it wholesale (text, type, and all options/answers),
 * so the validation rules are identical to creating one.
 */
class UpdateQuestionRequest extends StoreQuestionRequest
{
}
