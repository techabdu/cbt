<?php

namespace App\Http\Requests\Lecturer;

use App\Enums\Semester;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuestionBankRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'    => ['nullable', 'string', 'max:255'],
            'session'  => ['sometimes', 'string', 'regex:/^\d{4}\/\d{4}$/'],
            'semester' => ['sometimes', Rule::enum(Semester::class)],
        ];
    }
}
